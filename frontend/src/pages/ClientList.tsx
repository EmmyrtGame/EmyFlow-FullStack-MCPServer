import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { clientService } from '@/services/api';


interface Client {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    timezone: string;
    createdAt: string;
}

export default function ClientList() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(10);

    const debouncedSearch = useDebounce(search, 500);

    // Reset page when search changes (user types new query)
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    // Fetch when page or debouncedSearch changes
    useEffect(() => {
        fetchClients(page, debouncedSearch);
    }, [page, debouncedSearch]);

    const fetchClients = async (pageNum: number, searchQuery: string) => {
        try {
            setLoading(true);
            const response = await clientService.getAll({
                page: pageNum,
                limit,
                search: searchQuery
            });
            setClients(response.data);
            const total = response.meta.total;
            setTotalPages(Math.ceil(total / limit));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to generate page numbers
    const getPageNumbers = () => {
        const pages = [];
        // Simple logic: always show first, last, current, and neighbours
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (page <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (page >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage your dental clinic tenants</p>
                </div>
                <Button onClick={() => navigate('/clients/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Client
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Client Registry</CardTitle>
                    <div className="mt-4">
                        <Input
                            placeholder="Search clients..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Timezone</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : clients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">
                                        No clients found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                clients.map((client) => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">{client.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{client.slug}</TableCell>
                                        <TableCell>
                                            <Badge variant={client.isActive ? 'default' : 'destructive'} className={client.isActive ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                {client.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{client.timezone}</TableCell>
                                        <TableCell>{new Date(client.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${client.id}`)}>Edit</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-4 border-t">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                                        aria-disabled={page <= 1}
                                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>

                                {getPageNumbers().map((p, i) => (
                                    <PaginationItem key={i}>
                                        {p === '...' ? (
                                            <PaginationEllipsis />
                                        ) : (
                                            <PaginationLink
                                                href="#"
                                                isActive={page === p}
                                                onClick={(e) => { e.preventDefault(); setPage(Number(p)); }}
                                            >
                                                {p}
                                            </PaginationLink>
                                        )}
                                    </PaginationItem>
                                ))}

                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                                        aria-disabled={page >= totalPages}
                                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </Card>
        </div>
    );
}
