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
import { Deal, CreateDealBodyStage, useCreateDeal, useUpdateDeal, useListContacts, useListCompanies, getListContactsQueryKey, getListCompaniesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListDealsQueryKey, getGetDealQueryKey, getGetDealsByStageQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  value: z.coerce.number().optional().or(z.literal("")),
  stage: z.nativeEnum(CreateDealBodyStage),
  contactId: z.coerce.number().optional().or(z.literal("")),
  companyId: z.coerce.number().optional().or(z.literal("")),
  closeDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal;
  defaultStage?: CreateDealBodyStage;
}

export function DealDialog({ open, onOpenChange, deal, defaultStage }: DealDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  
  const { data: contacts } = useListContacts(undefined, { query: { queryKey: getListContactsQueryKey() } });
  const { data: companies } = useListCompanies(undefined, { query: { queryKey: getListCompaniesQueryKey() } });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      value: "",
      stage: defaultStage || "prospecting",
      contactId: "" as any,
      companyId: "" as any,
      closeDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (deal && open) {
      form.reset({
        title: deal.title,
        value: deal.value || "",
        stage: deal.stage as any,
        contactId: deal.contactId || ("" as any),
        companyId: deal.companyId || ("" as any),
        closeDate: deal.closeDate ? deal.closeDate.split('T')[0] : "",
        notes: deal.notes || "",
      });
    } else if (open) {
      form.reset({
        title: "",
        value: "",
        stage: defaultStage || "prospecting",
        contactId: "" as any,
        companyId: "" as any,
        closeDate: "",
        notes: "",
      });
    }
  }, [deal, open, form, defaultStage]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const data = {
      ...values,
      value: values.value ? Number(values.value) : null,
      contactId: values.contactId && values.contactId !== "none" ? Number(values.contactId) : null,
      companyId: values.companyId && values.companyId !== "none" ? Number(values.companyId) : null,
      closeDate: values.closeDate ? new Date(values.closeDate).toISOString() : null,
      notes: values.notes || null,
    };

    if (deal) {
      updateDeal.mutate(
        { id: deal.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDealQueryKey(deal.id) });
            queryClient.invalidateQueries({ queryKey: getGetDealsByStageQueryKey() });
            toast({ title: "Deal updated" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error updating deal", variant: "destructive" }),
        }
      );
    } else {
      createDeal.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDealsByStageQueryKey() });
            toast({ title: "Deal created" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error creating deal", variant: "destructive" }),
        }
      );
    }
  }

  const isPending = createDeal.isPending || updateDeal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "New Deal"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Title</FormLabel>
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
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value ($)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="prospecting">Prospecting</SelectItem>
                        <SelectItem value="qualification">Qualification</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="closed_won">Closed Won</SelectItem>
                        <SelectItem value="closed_lost">Closed Lost</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={String(field.value || "")}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {contacts?.map((contact) => (
                          <SelectItem key={contact.id} value={String(contact.id)}>
                            {contact.firstName} {contact.lastName}
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
            </div>

            <FormField
              control={form.control}
              name="closeDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Close Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
