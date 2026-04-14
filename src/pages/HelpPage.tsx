import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

function downloadTemplate() {
  const csv = "name,phone,alternate_phone,wallet,bank_account\nأحمد محمد,01012345678,01112345678,01212345678,\nسارة علي,01098765432,,,\nمحمد حسن,01551234567,01021234567,,01234567890\nخالد إبراهيم,01278901234,,,01278901234";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "people_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Instructions</h1>
        <p className="text-muted-foreground">How to use the People & CSV import features</p>
      </div>

      {/* Section 1: Adding People Manually */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b border-border pb-2">1. Adding a Person Manually</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-foreground/90">
          <li>Go to the <strong>People</strong> page from the sidebar.</li>
          <li>Click <strong>"Add Person"</strong> in the top-right corner.</li>
          <li>Enter the person's full name.</li>
          <li>Add one or more phone numbers (see section 3 below for types).</li>
          <li>Click <strong>"Add Person"</strong> to save.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          💡 When you add a person, the system automatically searches for any previous uploads matching their phone number(s) and links them to this person.
        </p>
      </section>

      {/* Section 2: CSV Import */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b border-border pb-2">2. Importing People via CSV</h2>
        <p className="text-sm text-foreground/90">
          You can bulk-import people using a CSV file. Here's how:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-foreground/90">
          <li>Go to the <strong>People</strong> page.</li>
          <li>Click <strong>"Import CSV"</strong>.</li>
          <li>Download the template file (or create your own following the format below).</li>
          <li>Fill in your data and save the file as <code className="text-xs bg-muted px-1 rounded">.csv</code> (UTF-8 encoding).</li>
          <li>Upload the file — you'll see a preview before importing.</li>
          <li>Click <strong>"Import"</strong> to add all people at once.</li>
        </ol>

        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">Required & Optional Columns</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium">Column Name</th>
                  <th className="px-3 py-2 font-medium">Required?</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">name</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Yes</td>
                  <td className="px-3 py-2 text-muted-foreground">Full name of the person</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">phone</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Yes</td>
                  <td className="px-3 py-2 text-muted-foreground">Primary phone number (e.g. 01012345678)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">alternate_phone</td>
                  <td className="px-3 py-2 text-muted-foreground">No</td>
                  <td className="px-3 py-2 text-muted-foreground">A second phone number</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">wallet</td>
                  <td className="px-3 py-2 text-muted-foreground">No</td>
                  <td className="px-3 py-2 text-muted-foreground">Mobile wallet number</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">bank_account</td>
                  <td className="px-3 py-2 text-muted-foreground">No</td>
                  <td className="px-3 py-2 text-muted-foreground">Bank account number</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Alternative header names are also accepted: <code className="bg-muted px-1 rounded">full_name</code>, <code className="bg-muted px-1 rounded">الاسم</code>, <code className="bg-muted px-1 rounded">رقم التليفون</code>, <code className="bg-muted px-1 rounded">رقم بديل</code>, <code className="bg-muted px-1 rounded">المحفظة</code>, <code className="bg-muted px-1 rounded">حساب بنكي</code>
          </p>
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold">Example CSV Content</h3>
          <pre className="text-xs font-mono bg-background rounded p-3 overflow-x-auto border border-border">
{`name,phone,alternate_phone,wallet
أحمد محمد,01012345678,01112345678,01212345678
سارة علي,01098765432,,
محمد حسن,01551234567,01021234567,`}
          </pre>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-3 w-3" />Download Template CSV
          </Button>
        </div>
      </section>

      {/* Section 3: Multiple Phone Numbers */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b border-border pb-2">3. Handling Multiple Phone Numbers</h2>
        <p className="text-sm text-foreground/90">
          Each person can have multiple phone numbers of different types. The system uses these numbers to automatically match uploaded transfer screenshots to the right person.
        </p>
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Phone Number Types</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded shrink-0">Primary</span>
              <span className="text-muted-foreground">The main phone number — used first for matching transfers.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded shrink-0">Alternate</span>
              <span className="text-muted-foreground">A secondary number — also used for matching.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded shrink-0">Wallet</span>
              <span className="text-muted-foreground">A mobile wallet number (e.g. Vodafone Cash, InstaPay).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded shrink-0">Bank Account</span>
              <span className="text-muted-foreground">A bank account number linked to this person.</span>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Adding Multiple Numbers (Manual)</h3>
          <p className="text-sm text-muted-foreground">
            When adding or editing a person, click the <strong>"Add"</strong> button next to "Phone Numbers" to add more entries. Select the type from the dropdown for each number.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Adding Multiple Numbers (CSV)</h3>
          <p className="text-sm text-muted-foreground">
            In a CSV file, use separate columns for each phone type. Each column maps to a phone number type automatically. Leave a column empty if a person doesn't have that type of number.
          </p>
        </div>
      </section>

      {/* Section 4: Auto-linking */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b border-border pb-2">4. Automatic Upload Linking</h2>
        <p className="text-sm text-foreground/90">
          Whenever you add a person (manually or via CSV), the system automatically:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
          <li>Searches all previous transfer screenshots for matching phone numbers.</li>
          <li>Links any unassigned matches to this person's profile.</li>
          <li>Shows you a notification with the number of linked uploads.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          This means you can upload screenshots <em>before</em> adding the person — they'll be linked automatically later.
        </p>
      </section>

      {/* Section 5: Phone Format */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b border-border pb-2">5. Phone Number Format</h2>
        <p className="text-sm text-foreground/90">
          Egyptian mobile numbers should be 11 digits starting with <code className="text-xs bg-muted px-1 rounded">01</code>. The system accepts multiple formats:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><code className="bg-muted px-1 rounded">01012345678</code> — standard format</li>
          <li><code className="bg-muted px-1 rounded">+201012345678</code> — international format (auto-converted)</li>
          <li><code className="bg-muted px-1 rounded">201012345678</code> — without + (auto-converted)</li>
          <li>Arabic-Indic digits <code className="bg-muted px-1 rounded">٠١٠١٢٣٤٥٦٧٨</code> are also supported</li>
        </ul>
      </section>
    </div>
  );
}
