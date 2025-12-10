
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClientForm } from '@/components/ClientForm';
import { clientService } from '@/services/api';
import { type ClientFormValues } from '@/schemas/clientSchema';
import { toast } from 'sonner';

export default function ClientEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = id && id !== 'new';

    const [initialData, setInitialData] = useState<ClientFormValues | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(isEditMode ? true : false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            loadClient(id);
        }
    }, [id, isEditMode]);

    const loadClient = async (clientId: string) => {
        try {
            const data = await clientService.getOne(clientId);
            setInitialData(data);
        } catch (error) {
            console.error('Failed to load client:', error);
            toast.error('Failed to load client data');
            navigate('/clients');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (values: ClientFormValues, serviceAccountFile?: File) => {
        setIsSubmitting(true);
        try {
            if (!values.meta?.accessToken && values.meta) {
                values.meta.accessToken = undefined;
            }

            // Handle Wassenger Key Logic:
            if (!values.wassenger?.apiKey && values.wassenger) {
                values.wassenger.apiKey = undefined;
            }

            let savedClient;
            if (isEditMode && id) {
                savedClient = await clientService.update(id, values);
                toast.success('Client updated successfully');
            } else {
                savedClient = await clientService.create(values);
                toast.success('Client created successfully');
            }

            // Handle File Upload if present
            const clientId = savedClient?.id;

            if (serviceAccountFile && clientId) {
                try {
                    const uploadRes = await clientService.uploadServiceAccount(clientId, serviceAccountFile);
                    // CRITICAL: Update the client with the NEW path returned by upload
                    if (uploadRes.path) {
                        const updatedGoogleConfig = {
                            ...values.google,
                            serviceAccountPath: uploadRes.path
                        };

                        await clientService.update(clientId, {
                            ...values,
                            google: updatedGoogleConfig
                        });
                    }

                } catch (uploadError) {
                    console.error('File upload failed', uploadError);
                    toast.error('Client saved but Service Account upload failed');
                }
            }

            navigate('/clients');
        } catch (error: any) {
            console.error('Submit error:', error);
            toast.error(error.response?.data?.message || 'Failed to save client');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Loading client data...</div>;
    }

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                    {isEditMode ? 'Edit Client' : 'New Client'}
                </h1>
                <p className="text-muted-foreground">
                    {isEditMode ? 'Update client configuration and settings.' : 'Onboard a new dental clinic.'}
                </p>
            </div>

            <ClientForm
                initialData={initialData}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
