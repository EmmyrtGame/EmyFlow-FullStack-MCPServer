import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { PlusIcon, TrashIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ClientFormValues, clientSchema, defaultValues } from '../schemas/clientSchema';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ClientFormProps {
    initialData?: ClientFormValues;
    onSubmit: (values: ClientFormValues, serviceAccountFile?: File) => Promise<void>;
    isSubmitting?: boolean;
}

export function ClientForm({ initialData, onSubmit, isSubmitting = false }: ClientFormProps) {
    const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null);

    const form = useForm<ClientFormValues>({
        resolver: zodResolver(clientSchema) as any,
        defaultValues: initialData || defaultValues,
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "locations"
    });

    const handleFormSubmit = async (values: ClientFormValues) => {
        await onSubmit(values, serviceAccountFile || undefined);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setServiceAccountFile(e.target.files[0]);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8 pb-10">

                {/* Section 1: General Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>General Information</CardTitle>
                        <CardDescription>Basic client details and identifying information.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Client Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Dental Clinic Name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="slug"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Slug (ID)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="clinic_name" {...field} />
                                        </FormControl>
                                        <FormDescription>Unique identifier for URLs and database.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="timezone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Timezone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="America/Mexico_City" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Active Status</FormLabel>
                                        <FormDescription>
                                            Enable or disable all automated interactions for this client.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Section 2: Integrations (Google, Meta, Wassenger) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Integrations & Credentials</CardTitle>
                        <CardDescription>Configure external service connections.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Google Service Account */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Google Service Account
                            </h3>
                            <div className="bg-slate-50 p-4 rounded-md border">
                                <div className="flex items-center gap-4">
                                    <Input
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileChange}
                                        className="max-w-md bg-white"
                                    />
                                    {initialData?.google?.serviceAccountPath && !serviceAccountFile && (
                                        <span className="text-sm text-green-600 font-medium">✓ Configured</span>
                                    )}
                                </div>
                                <p className="mt-2 text-[0.8rem] text-muted-foreground">
                                    Upload the Google Service Account JSON key file. Required for Calendar API access.
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Meta / Facebook */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="meta.pixelId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Meta Pixel ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="1234567890" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="meta.accessToken"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Conversion API Access Token</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="EAAB..." className="font-mono text-xs" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator />

                        {/* Wassenger */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="wassenger.apiKey"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Wassenger API Key</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="Key..." className="font-mono text-xs" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="wassenger.deviceId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Wassenger Device ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Device ID" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Section 3: Locations */}
                <Card>
                    <CardHeader>
                        <CardTitle>Locations & Calendars</CardTitle>
                        <CardDescription>
                            Configure at least one location. Availability checks are performed per-location.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="border p-4 rounded-md space-y-4 bg-slate-50 relative">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-slate-100"
                                    onClick={() => remove(index)}
                                // Prevent removing the last item if validation requires min 1? 
                                // Zod handles submit validation, visual feedback is enough.
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">
                                        Location #{index + 1}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name={`locations.${index}.name`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Sede Identifier</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="center_1" {...field} />
                                                </FormControl>
                                                <FormDescription className="text-xs">Internal ID (no spaces)</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`locations.${index}.address`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="123 Street..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`locations.${index}.mapUrl`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Map URL</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="https://maps..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Separator className="my-2 bg-slate-200" />

                                <div className="bg-white p-3 rounded border border-slate-100">
                                    <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <InfoCircledIcon /> Google Calendar Configuration
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`locations.${index}.google.bookingCalendarId`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Booking Calendar ID</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="c_xxxxxxxx..." className="font-mono text-xs" {...field} />
                                                    </FormControl>
                                                    <FormDescription className="text-xs">Appointments are created here.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`locations.${index}.google.availabilityCalendars`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Availability Calendars</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="id1@group.calendar.google.com, id2@..."
                                                            className="min-h-[80px] font-mono text-xs"
                                                            value={Array.isArray(field.value) ? field.value.join('\n') : (field.value || '')}
                                                            onChange={(e) => {
                                                                // Convert newline/comma text to array of strings
                                                                const val = e.target.value;
                                                                // We update the field value as array
                                                                const arr = val.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
                                                                field.onChange(arr);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormDescription className="text-xs">
                                                        One ID per line. Checked for conflicts.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full border-dashed py-6"
                            onClick={() => append({
                                name: '',
                                address: '',
                                mapUrl: '',
                                google: { bookingCalendarId: '', availabilityCalendars: [] }
                            })}
                        >
                            <PlusIcon className="mr-2 h-4 w-4" /> Add Location (Sede)
                        </Button>
                        {form.formState.errors.locations && (
                            <p className="text-sm font-medium text-destructive">
                                {form.formState.errors.locations.message}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Section 4: Templates */}
                <Card>
                    <CardHeader>
                        <CardTitle>Reminder Templates</CardTitle>
                        <CardDescription>Customize the messages sent to patients.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <Alert className="bg-blue-50 border-blue-200">
                            <InfoCircledIcon className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Available Variables</AlertTitle>
                            <AlertDescription className="text-blue-700 text-xs mt-1">
                                <strong>{"{{patient_name}}"}</strong>: Name of the patient<br />
                                <strong>{"{{time}}"}</strong>: Appointment time (e.g., 10:30 AM)<br />
                                <strong>{"{{date}}"}</strong>: Appointment date (e.g., Nov 25)<br />
                                <strong>{"{{location_name}}"}</strong>: Name/Sede of the location<br />
                                <strong>{"{{location_address}}"}</strong>: Address of the location<br />
                                <strong>{"{{location_map}}"}</strong>: Google Maps URL
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="reminderTemplates.24h"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>24 Hours Before</FormLabel>
                                        <FormControl>
                                            <Textarea className="min-h-[120px]" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="reminderTemplates.3h"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>3 Hours Before</FormLabel>
                                        <FormControl>
                                            <Textarea className="min-h-[120px]" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="reminderTemplates.1h"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>1 Hour Before</FormLabel>
                                        <FormControl>
                                            <Textarea className="min-h-[120px]" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Submit Actions */}
                <div className="sticky bottom-4 flex justify-end gap-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg z-10">
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Client Configuration'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
