import { Shell } from "@/components/layout/Shell";
import { useListContacts, getListContactsQueryKey, useDeleteContact } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ContactDialog } from "@/components/ContactDialog";
import { DeleteDialog } from "@/components/DeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  prospect: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  customer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const { data: contacts, isLoading } = useListContacts(
    { search: search || undefined },
    { query: { queryKey: getListContactsQueryKey({ search: search || undefined }) } }
  );

  const deleteContact = useDeleteContact();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setDialogOpen(true);
  };

  const handleDelete = (contact: any) => {
    setSelectedContact(contact);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedContact) return;
    deleteContact.mutate(
      { id: selectedContact.id },
      {
        onSuccess: () => {
          toast({ title: "Contact deleted" });
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          setDeleteOpen(false);
        },
        onError: () => {
          toast({ title: "Failed to delete contact", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <Button onClick={() => { setSelectedContact(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Contact
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[180px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : contacts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No contacts found.
                  </TableCell>
                </TableRow>
              ) : (
                contacts?.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <Link href={`/contacts/${contact.id}`} className="hover:underline hover:text-primary">
                        {contact.firstName} {contact.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {contact.companyId ? (
                        <Link href={`/companies/${contact.companyId}`} className="hover:underline">
                          {contact.companyName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${statusColors[contact.status] || ""}`}>
                        {contact.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{contact.email || "-"}</TableCell>
                    <TableCell>{contact.phone || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(contact)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(contact)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={selectedContact}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Contact"
        description={`Are you sure you want to delete ${selectedContact?.firstName} ${selectedContact?.lastName}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        isDeleting={deleteContact.isPending}
      />
    </Shell>
  );
}
