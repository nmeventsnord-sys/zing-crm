import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Company, useCreateCompany, useUpdateCompany } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListCompaniesQueryKey, getGetCompanyQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  industry: z.string().optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  size: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}

export function CompanyDialog({ open, onOpenChange, company }: CompanyDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      industry: "",
      website: "",
      size: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (company && open) {
      form.reset({
        name: company.name,
        industry: company.industry || "",
        website: company.website || "",
        size: company.size || "",
        notes: company.notes || "",
      });
    } else if (open) {
      form.reset({
        name: "",
        industry: "",
        website: "",
        size: "",
        notes: "",
      });
    }
  }, [company, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const data = {
      ...values,
      industry: values.industry || null,
      website: values.website || null,
      size: values.size || null,
      notes: values.notes || null,
    };

    if (company) {
      updateCompany.mutate(
        { id: company.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey(company.id) });
            toast({ title: "Company updated" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error updating company", variant: "destructive" }),
        }
      );
    } else {
      createCompany.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
            toast({ title: "Company created" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error creating company", variant: "destructive" }),
        }
      );
    }
  }

  const isPending = createCompany.isPending || updateCompany.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{company ? "Edit Company" : "New Company"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size / Employees</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 50-200" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
