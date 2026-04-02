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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Contact, CreateContactBodyStatus, useCreateContact, useUpdateContact, useListCompanies, getListCompaniesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListContactsQueryKey, getGetContactQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  companyId: z.coerce.number().optional().or(z.literal("")),
  status: z.nativeEnum(CreateContactBodyStatus),
  notes: z.string().optional().or(z.literal("")),
});

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
}

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  
  const { data: companies } = useListCompanies(undefined, { query: { queryKey: getListCompaniesQueryKey() } });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyId: "" as any,
      status: "lead",
      notes: "",
    },
  });

  useEffect(() => {
    if (contact && open) {
      form.reset({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || "",
        phone: contact.phone || "",
        companyId: contact.companyId || ("" as any),
        status: contact.status as any,
        notes: contact.notes || "",
      });
    } else if (open) {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        companyId: "" as any,
        status: "lead",
        notes: "",
      });
    }
  }, [contact, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const data = {
      ...values,
      email: values.email || null,
      phone: values.phone || null,
      companyId: values.companyId ? Number(values.companyId) : null,
      notes: values.notes || null,
    };

    if (contact) {
      updateContact.mutate(
        { id: contact.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetContactQueryKey(contact.id) });
            toast({ title: "Contact updated" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error updating contact", variant: "destructive" }),
        }
      );
    } else {
      createContact.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
            toast({ title: "Contact created" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error creating contact", variant: "destructive" }),
        }
      );
    }
  }

  const isPending = createContact.isPending || updateContact.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={String(field.value || "")}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={String(company.id)}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
