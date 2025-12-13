import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { PlusIcon, TrashIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import {
    User, MapPin, Calendar, Clock, Smartphone, Globe, Hash, Key, Layout
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientService } from '@/services/api';
import { useEffect } from 'react';

interface ClientFormProps {
    initialData?: ClientFormValues;
    onSubmit: (values: ClientFormValues, serviceAccountFile?: File) => Promise<void>;
    isSubmitting?: boolean;
}

export function ClientForm({ initialData, onSubmit, isSubmitting = false }: ClientFormProps) {
    const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null);
    const [credentialMode, setCredentialMode] = useState<'existing' | 'upload'>('upload');
    const [existingCredentials, setExistingCredentials] = useState<{ name: string, path: string }[]>([]);

    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingValues, setPendingValues] = useState<ClientFormValues | null>(null);
    const [changesList, setChangesList] = useState<string[]>([]);

    // Prepare default values: Clear sensitive fields if editing for security
    const preparedDefaultValues = initialData ? {
        ...initialData,
        meta: {
            ...initialData.meta,
            accessToken: ''
        },
        google: initialData.google || defaultValues.google,
        wassenger: {
            ...initialData.wassenger,
            apiKey: ''
        }
    } : defaultValues;

    const form = useForm<ClientFormValues>({
        resolver: zodResolver(clientSchema) as any,
        defaultValues: preparedDefaultValues,
    });

    // Load existing credentials on mount
    useEffect(() => {
        clientService.getCredentials().then((data: Array<{ id: string, name: string, path: string }>) => {
            setExistingCredentials(data);

            // Check if client has a linked service account ID
            const serviceAccountId = (initialData as any)?.serviceAccountId;

            if (serviceAccountId) {
                const matched = data.find(c => c.id === serviceAccountId);
                if (matched) {
                    setCredentialMode('existing');
                    const currentValues = form.getValues();
                    // Reset form to make this the "clean" initial state
                    form.reset({
                        ...currentValues,
                        google: {
                            ...currentValues.google,
                            serviceAccountPath: matched.path
                        }
                    });
                }
            } else if (initialData?.google?.serviceAccountPath) {
                setCredentialMode('existing');
            }
        }).catch((err: any) => console.error("Failed to load credentials", err));
    }, [initialData, form]);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "locations"
    });

    const getChanges = (newValues: ClientFormValues) => {
        const changes: string[] = [];
        if (!initialData) return ["Creating new client configuration"];

        if (newValues.name !== initialData.name) changes.push(`Name changed to: ${newValues.name}`);
        if (newValues.slug !== initialData.slug) changes.push(`Slug changed to: ${newValues.slug}`);
        if (newValues.isActive !== initialData.isActive) changes.push(`Active Status changed: ${newValues.isActive}`);

        if (newValues.webhookUrl !== initialData.webhookUrl) changes.push(`Webhook URL updated`);

        // Integrations
        if (credentialMode !== 'existing' && serviceAccountFile) changes.push("Uploading new Service Account File");
        if (credentialMode === 'existing' && newValues.google?.serviceAccountPath !== initialData.google?.serviceAccountPath) changes.push("Selected different Service Account");

        if (newValues.meta?.pixelId !== initialData.meta?.pixelId) changes.push("Meta Pixel ID updated");
        if (newValues.meta?.accessToken) changes.push("Meta Access Token updated"); // Only if provided

        if (newValues.wassenger?.apiKey) changes.push("Wassenger API Key updated"); // Only if provided
        if (newValues.wassenger?.deviceId !== initialData.wassenger?.deviceId) changes.push("Wassenger Device ID updated");

        // Locations (Simple count check or deep check)
        if (JSON.stringify(newValues.locations) !== JSON.stringify(initialData.locations)) {
            changes.push("Locations configuration updated");
        }

        // Templates
        if (JSON.stringify(newValues.reminderTemplates) !== JSON.stringify(initialData.reminderTemplates)) {
            changes.push("Reminder Templates updated");
        }

        return changes.length > 0 ? changes : ["No significant changes detected"];
    };

    const handlePreSubmit = (values: ClientFormValues) => {
        // Transform availabilityCalendars to array of strings for consistency
        const transformedValues: ClientFormValues = {
            ...values,
            locations: values.locations.map(loc => ({
                ...loc,
                google: {
                    ...loc.google,
                    availabilityCalendars: Array.isArray(loc.google.availabilityCalendars)
                        ? loc.google.availabilityCalendars
                        : (loc.google.availabilityCalendars as string).split(/[\n,]/).map(s => s.trim()).filter(Boolean)
                }
            }))
        };

        const changes = getChanges(transformedValues);
        setChangesList(changes);
        setPendingValues(transformedValues);
        setShowConfirm(true);
    };

    const confirmSubmit = async () => {
        if (pendingValues) {
            await onSubmit(pendingValues, serviceAccountFile || undefined);
            setShowConfirm(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setServiceAccountFile(e.target.files[0]);
        }
    };

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handlePreSubmit)} className="space-y-8 pb-10">

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
                                        <FormLabel>Brand Name</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input className="pl-9" placeholder="Business Name" {...field} />
                                            </div>
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
                                                <div className="relative">
                                                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input className="pl-9" /* Placeholder checks logic_name */ {...field} />
                                                </div>
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
                                                <div className="relative">
                                                    <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input className="pl-9" placeholder="America/Mexico_City" {...field} />
                                                </div>
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Integrations & Credentials</CardTitle>
                            <CardDescription>Configure external service connections.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <FormField
                                control={form.control}
                                name="webhookUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Client Webhook URL</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input className="pl-9" placeholder="https://..." {...field} />
                                            </div>
                                        </FormControl>
                                        <FormDescription>
                                            Endpoint to receive incoming messages.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="text-sm font-medium leading-none">
                                    Google Service Account
                                </h3>
                                <div className="bg-slate-50 p-4 rounded-md border space-y-4">
                                    <RadioGroup
                                        value={credentialMode}
                                        onValueChange={(val) => setCredentialMode(val as any)}
                                        className="flex flex-row gap-4"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="existing" id="mode-existing" />
                                            <Label htmlFor="mode-existing" className="font-normal cursor-pointer">Select Existing</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="upload" id="mode-upload" />
                                            <Label htmlFor="mode-upload" className="font-normal cursor-pointer">Upload New</Label>
                                        </div>
                                    </RadioGroup>

                                    {credentialMode === 'existing' ? (
                                        <FormField
                                            control={form.control}
                                            name="google.serviceAccountPath"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Select Credential File</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select a JSON file" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {existingCredentials.map((cred) => (
                                                                <SelectItem key={cred.path} value={cred.path}>
                                                                    {cred.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>Upload JSON Key</Label>
                                            <div className="flex items-center gap-4">
                                                <Input
                                                    type="file"
                                                    accept=".json"
                                                    onChange={handleFileChange}
                                                    className="max-w-md bg-white"
                                                />
                                                {initialData?.google?.serviceAccountPath && !serviceAccountFile && (
                                                    <span className="text-sm text-green-600 font-medium">
                                                        ✓ Configured: {initialData.google.serviceAccountPath.split('/').pop()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[0.8rem] text-muted-foreground">
                                                This will upload and encrypt a new service account file.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="meta.pixelId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Pixel ID</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Layout className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input className="pl-9" placeholder="1234567890" {...field} />
                                                </div>
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
                                                <div className="relative">
                                                    <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        className="pl-9 font-mono text-xs"
                                                        type="password"
                                                        placeholder={initialData?.meta?.accessToken ? "Saved (Enter new to update)" : "EAAB..."}
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="wassenger.apiKey"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Wassenger API Key</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        className="pl-9 font-mono text-xs"
                                                        type="password"
                                                        placeholder={initialData?.wassenger?.apiKey ? "Saved (Enter new to update)" : "Key..."}
                                                        {...field}
                                                    />
                                                </div>
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
                                                <div className="relative">
                                                    <Smartphone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input className="pl-9" placeholder="Device ID" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

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
                                                        <div className="relative">
                                                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input className="pl-9" placeholder="center_1" {...field} />
                                                        </div>
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
                                                        <div className="relative">
                                                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input className="pl-9" placeholder="123 Street..." {...field} />
                                                        </div>
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
                                                        <div className="relative">
                                                            <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input className="pl-9" placeholder="https://maps..." {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`locations.${index}.phone`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Location Phone</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Smartphone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input className="pl-9" placeholder="312 128..." {...field} />
                                                        </div>
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
                                                            <div className="relative">
                                                                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                <Input className="pl-9 font-mono text-xs" placeholder="c_xxxxxxxx..." {...field} />
                                                            </div>
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
                                                                    field.onChange(e.target.value);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">
                                                            One ID per line or comma separated.
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
                                onClick={() => {
                                    append({
                                        name: '',
                                        address: '',
                                        mapUrl: '',
                                        google: { bookingCalendarId: '', availabilityCalendars: [] }
                                    });
                                    form.clearErrors("locations");
                                }}
                            >
                                <PlusIcon className="mr-2 h-4 w-4" /> Add Location (Sede)
                            </Button>
                            {/* Global Location Error (e.g. min 1) */}
                            {form.formState.errors.locations && (
                                ((form.formState.errors.locations as any)?.message || (form.formState.errors.locations as any)?.root?.message) && (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {(form.formState.errors.locations as any)?.message ||
                                                (form.formState.errors.locations as any)?.root?.message}
                                        </AlertDescription>
                                    </Alert>
                                )
                            )}
                        </CardContent>
                    </Card>

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
                                    <strong>{"{{location_name}}"}</strong>: Name of the Consultory/Office (Brand)<br />
                                    <strong>{"{{location_address}}"}</strong>: Address of the location<br />
                                    <strong>{"{{location_map}}"}</strong>: Google Maps URL<br />
                                    <strong>{"{{location_phone}}"}</strong>: Location Phone Number
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

                    <div className="sticky bottom-4 flex justify-end gap-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg z-10">
                        <Button type="button" variant="outline" onClick={() => window.history.back()}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || (!form.formState.isDirty && !serviceAccountFile)}>
                            {isSubmitting ? 'Saving...' : 'Save Client Configuration'}
                        </Button>
                    </div>
                </form>
            </Form>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            The following changes will be applied:
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <ul className="list-disc pl-4 space-y-1 text-sm text-slate-700">
                            {changesList.map((change, i) => (
                                <li key={i}>{change}</li>
                            ))}
                        </ul>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmSubmit}>Confirm & Save</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

