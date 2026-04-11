import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { normalizePhone } from "@/lib/phone-utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneType, setPhoneType] = useState("primary_phone");
  const [search, setSearch] = useState("");

  const { data: people } = useQuery({
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

      if (phone) {
        const { error: idError } = await supabase.from("person_identifiers").insert({
          person_id: person.id,
          identifier_type: phoneType,
          raw_value: phone,
          normalized_value: normalizePhone(phone),
          is_primary: phoneType === "primary_phone",
        });
        if (idError) throw idError;
      }
      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      setName("");
      setPhone("");
      setOpen(false);
      toast.success("Person added");
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Person</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01012345678" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={phoneType} onValueChange={setPhoneType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary_phone">Primary Phone</SelectItem>
                    <SelectItem value="alternate_phone">Alternate Phone</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="bank_account">Bank Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => addPerson.mutate()} disabled={!name}>Add Person</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Identifiers</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(p => (
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
                <td className="px-4 py-3">
                  <span className={`status-badge ${p.status === 'active' ? 'status-matched' : 'status-error'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="icon" onClick={() => deletePerson.mutate(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
