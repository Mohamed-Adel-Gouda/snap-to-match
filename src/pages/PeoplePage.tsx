import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { normalizePhone } from "@/lib/phone-utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

async function linkOrphanedUploads(personId: string, normalizedPhones: string[]): Promise<number> {
  if (normalizedPhones.length === 0) return 0;
  const { data, error } = await supabase
    .from("transfer_screenshots")
    .update({
      matched_person_id: personId,
      match_type: "retroactive",
      auto_matched: true,
    })
    .is("matched_person_id", null)
    .in("extracted_phone_normalized", normalizedPhones)
    .select("id");
  if (error) throw error;
  return data?.length || 0;
}

interface PhoneEntry {
  id?: string;
  phone: string;
  type: string;
}

function isValidEgyptianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('01');
}

function PhoneFields({ phones, setPhones }: { phones: PhoneEntry[]; setPhones: (p: PhoneEntry[]) => void }) {
  const addPhone = () => setPhones([...phones, { phone: "", type: "primary_phone" }]);
  const removePhone = (idx: number) => setPhones(phones.filter((_, i) => i !== idx));
  const updatePhone = (idx: number, field: keyof PhoneEntry, value: string) => {
    if (field === "phone") {
      value = value.replace(/[^\d+]/g, '');
    }
    setPhones(phones.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Phone Numbers</Label>
        <Button type="button" variant="outline" size="sm" onClick={addPhone}>
          <Plus className="mr-1 h-3 w-3" />Add
        </Button>
      </div>
      {phones.map((entry, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex gap-2 items-start">
            <Input
              value={entry.phone}
              onChange={e => updatePhone(idx, "phone", e.target.value)}
              placeholder="01012345678"
              className="flex-1"
            />
            <Select value={entry.type} onValueChange={v => updatePhone(idx, "type", v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary_phone">Primary</SelectItem>
                <SelectItem value="alternate_phone">Alternate</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="bank_account">Bank Account</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" onClick={() => removePhone(idx)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {entry.phone.trim() && !isValidEgyptianPhone(entry.phone) && (
            <p className="text-xs text-destructive ml-1">⚠ Expected 11-digit Egyptian number starting with 01</p>
          )}
        </div>
      ))}
      {phones.length === 0 && <p className="text-sm text-muted-foreground">No phone numbers added</p>}
    </div>
  );
}

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [phones, setPhones] = useState<PhoneEntry[]>([{ phone: "", type: "primary_phone" }]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhones, setEditPhones] = useState<PhoneEntry[]>([]);
  const [search, setSearch] = useState("");

  const { data: people, isLoading } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*, person_identifiers(*)")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const addPerson = useMutation({
    mutationFn: async () => {
      const { data: person, error } = await supabase
        .from("people")
        .insert({ full_name: name })
        .select()
        .single();
      if (error) throw error;

      const validPhones = phones.filter(p => p.phone.trim());
      if (validPhones.length > 0) {
        const { error: idError } = await supabase.from("person_identifiers").insert(
          validPhones.map((p, idx) => ({
            person_id: person.id,
            identifier_type: p.type,
            raw_value: p.phone,
            normalized_value: normalizePhone(p.phone),
            is_primary: idx === 0,
          }))
        );
        if (idError) throw idError;
      }

      const normalizedPhones = validPhones.map(p => normalizePhone(p.phone)).filter(Boolean);
      const linked = await linkOrphanedUploads(person.id, normalizedPhones);
      return { person, linked };
    },
    onSuccess: ({ person, linked }) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["screenshots"] });
      setName("");
      setPhones([{ phone: "", type: "primary_phone" }]);
      setAddOpen(false);
      if (linked > 0) {
        toast.success(`${person.full_name} added! ${linked} previous upload(s) were automatically assigned.`);
      } else {
        toast.success(`${person.full_name} added successfully`);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePerson = useMutation({
    mutationFn: async () => {
      if (!editId) return { linked: 0 };
      const { error } = await supabase.from("people").update({ full_name: editName }).eq("id", editId);
      if (error) throw error;

      const { error: delError } = await supabase.from("person_identifiers").delete().eq("person_id", editId);
      if (delError) throw delError;

      const validPhones = editPhones.filter(p => p.phone.trim());
      if (validPhones.length > 0) {
        const { error: idError } = await supabase.from("person_identifiers").insert(
          validPhones.map((p, idx) => ({
            person_id: editId,
            identifier_type: p.type,
            raw_value: p.phone,
            normalized_value: normalizePhone(p.phone),
            is_primary: idx === 0,
          }))
        );
        if (idError) throw idError;
      }

      const normalizedPhones = validPhones.map(p => normalizePhone(p.phone)).filter(Boolean);
      const linked = await linkOrphanedUploads(editId, normalizedPhones);
      return { linked };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["screenshots"] });
      setEditOpen(false);
      const linked = result?.linked || 0;
      if (linked > 0) {
        toast.success(`${editName} updated! ${linked} previous upload(s) were automatically assigned.`);
      } else {
        toast.success(`${editName} updated successfully`);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success("Person deleted");
    },
  });

  const openEdit = (person: any) => {
    setEditId(person.id);
    setEditName(person.full_name);
    setEditPhones(
      (person.person_identifiers || []).map((i: any) => ({
        id: i.id,
        phone: i.raw_value,
        type: i.identifier_type,
      }))
    );
    setEditOpen(true);
  };

  const filtered = (people || []).filter(p =>
    !search || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.person_identifiers?.some((id: any) => id.normalized_value.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-muted-foreground">{people?.length || 0} registered</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Person</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <PhoneFields phones={phones} setPhones={setPhones} />
              <Button className="w-full" onClick={() => addPerson.mutate()} disabled={!name.trim()}>Add Person</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Person</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <PhoneFields phones={editPhones} setPhones={setEditPhones} />
            <Button className="w-full" onClick={() => updatePerson.mutate()} disabled={!editName.trim()}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Identifiers</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 font-medium w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-14" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-16" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  {search ? "No results found" : "No people added yet. Click 'Add Person' to get started."}
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/people/${p.id}`} className="font-medium text-accent hover:underline">{p.full_name}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.person_identifiers as any[])?.map((id: any) => (
                        <span key={id.id} className="status-badge bg-muted text-muted-foreground font-mono text-xs">
                          {id.normalized_value}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`status-badge ${p.status === 'active' ? 'status-matched' : 'status-error'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {p.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this person and all their linked identifiers. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePerson.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
