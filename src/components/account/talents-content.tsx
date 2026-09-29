import { Plus, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockRoster } from "@/lib/mock-roster";

export function TalentsContent() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{mockRoster.length} talents managed</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-input px-4 py-2.5">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by talent name..."
              className="w-56 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button className="h-10 rounded-[6px]">
            <Plus className="size-4" />
            Add Talent
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md bg-muted">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Talent</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockRoster.map((talent) => (
              <TableRow key={talent.id} className="hover:bg-transparent">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                      <User className="size-4" />
                    </span>
                    <span className="font-medium text-foreground">{talent.name}</span>
                  </div>
                </TableCell>
                <TableCell>{talent.category}</TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" className="h-8 rounded-[6px] text-xs">
                    View Profile
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
