import { Shell } from "@/components/layout/Shell";
import { useListCompanies, getListCompaniesQueryKey, useDeleteCompany } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CompanyDialog } from "@/components/CompanyDialog";
import { DeleteDialog } from "@/components/DeleteDialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function Companies() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  const { data: companies, isLoading } = useListCompanies(
    { search: search || undefined },
    { query: { queryKey: getListCompaniesQueryKey({ search: search || undefined }) } }
  );

  const deleteCompany = useDeleteCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEdit = (company: any) => {
    setSelectedCompany(company);
    setDialogOpen(true);
  };

  const handleDelete = (company: any) => {
    setSelectedCompany(company);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedCompany) return;
    deleteCompany.mutate(
      { id: selectedCompany.id },
      {
        onSuccess: () => {
          toast({ title: "Company deleted" });
          queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
          setDeleteOpen(false);
        },
        onError: () => {
          toast({ title: "Failed to delete company", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <Button onClick={() => { setSelectedCompany(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Company
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
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
                <TableHead>Company Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[180px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : companies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No companies found.
                  </TableCell>
                </TableRow>
              ) : (
                companies?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      <Link href={`/companies/${company.id}`} className="hover:underline hover:text-primary">
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell>{company.industry || "-"}</TableCell>
                    <TableCell>{company.size || "-"}</TableCell>
                    <TableCell>
                      {company.website ? (
                        <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {company.website}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(company)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(company)}>
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

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={selectedCompany}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Company"
        description={`Are you sure you want to delete ${selectedCompany?.name}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        isDeleting={deleteCompany.isPending}
      />
    </Shell>
  );
}
