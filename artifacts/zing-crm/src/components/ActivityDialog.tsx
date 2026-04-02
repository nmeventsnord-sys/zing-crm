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
import { Checkbox } from "@/components/ui/checkbox";
import { Activity, CreateActivityBodyType, useCreateActivity, useUpdateActivity, useListContacts, useListDeals, getListContactsQueryKey, getListDealsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListActivitiesQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(CreateActivityBodyType),
  description: z.string().optional().or(z.literal("")),
  contactId: z.coerce.number().optional().or(z.literal("")),
  dealId: z.coerce.number().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  completed: z.boolean().default(false),
});

interface ActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: Activity;
  defaultContactId?: number;
  defaultDealId?: number;
}

export function ActivityDialog({ open, onOpenChange, activity, defaultContactId, defaultDealId }: ActivityDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  
  const { data: contacts } = useListContacts(undefined, { query: { queryKey: getListContactsQueryKey() } });
  const { data: deals } = useListDeals(undefined, { query: { queryKey: getListDealsQueryKey() } });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "task",
      description: "",
      contactId: defaultContactId ? String(defaultContactId) as any : ("" as any),
      dealId: defaultDealId ? String(defaultDealId) as any : ("" as any),
      dueDate: "",
      completed: false,
    },
  });

  useEffect(() => {
    if (activity && open) {
      form.reset({
        title: activity.title,
        type: activity.type as any,
        description: activity.description || "",
        contactId: activity.contactId ? String(activity.contactId) as any : ("" as any),
        dealId: activity.dealId ? String(activity.dealId) as any : ("" as any),
        dueDate: activity.dueDate ? new Date(activity.dueDate).toISOString().slice(0, 16) : "",
        completed: activity.completed,
      });
    } else if (open) {
      form.reset({
        title: "",
        type: "task",
        description: "",
        contactId: defaultContactId ? String(defaultContactId) as any : ("" as any),
        dealId: defaultDealId ? String(defaultDealId) as any : ("" as any),
        dueDate: "",
        completed: false,
      });
    }
  }, [activity, open, form, defaultContactId, defaultDealId]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const data = {
      ...values,
      contactId: values.contactId && values.contactId !== "none" ? Number(values.contactId) : null,
      dealId: values.dealId && values.dealId !== "none" ? Number(values.dealId) : null,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      description: values.description || null,
    };

    if (activity) {
      updateActivity.mutate(
        { id: activity.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
            toast({ title: "Activity updated" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error updating activity", variant: "destructive" }),
        }
      );
    } else {
      createActivity.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
            toast({ title: "Activity created" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error creating activity", variant: "destructive" }),
        }
      );
    }
  }

  const isPending = createActivity.isPending || updateActivity.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{activity ? "Edit Activity" : "New Activity"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date & Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
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
                    <FormLabel>Related Contact</FormLabel>
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
                name="dealId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Deal</FormLabel>
                    <Select onValueChange={field.onChange} value={String(field.value || "")}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {deals?.map((deal) => (
                          <SelectItem key={deal.id} value={String(deal.id)}>
                            {deal.title}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="completed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Mark as completed
                    </FormLabel>
                  </div>
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
