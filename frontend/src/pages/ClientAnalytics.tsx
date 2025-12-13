import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Users,
    CalendarCheck,
    MessageSquare,
    Phone,
    UserPlus,
    TrendingUp,
    Activity,
    Filter,
    Calendar,
    X
} from 'lucide-react';
import { analyticsService, clientService } from '@/services/api';

interface StatsData {
    lifetime?: {
        leads: number;
        appointments: number;
        messages: number;
        handoffs: number;
        newConversations: number;
    };
    monthly?: {
        leads: number;
        appointments: number;
        messages: number;
        handoffs: number;
        newConversations: number;
        month: string;
    };
    filtered?: {
        leads: number;
        appointments: number;
        messages: number;
        handoffs: number;
        newConversations: number;
    };
    dateRange?: {
        start: string;
        end: string;
    };
}

interface DailyBreakdown {
    date: string;
    leads: number;
    appointments: number;
    messages: number;
    handoffs: number;
    newConversations: number;
    total: number;
}

interface EventData {
    id: string;
    eventType: string;
    phone: string | null;
    metadata: any;
    createdAt: string;
}

interface ClientInfo {
    id: string;
    name: string;
    slug: string;
}

const eventTypeColors: Record<string, string> = {
    LEAD: 'bg-green-500',
    APPOINTMENT: 'bg-blue-500',
    MESSAGE: 'bg-gray-500',
    HANDOFF: 'bg-orange-500',
    NEW_CONVERSATION: 'bg-purple-500',
};

const eventTypeLabels: Record<string, string> = {
    LEAD: 'Lead',
    APPOINTMENT: 'Cita',
    MESSAGE: 'Mensaje',
    HANDOFF: 'Handoff',
    NEW_CONVERSATION: 'Nueva Conv.',
};

export default function ClientAnalytics() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [client, setClient] = useState<ClientInfo | null>(null);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
    const [events, setEvents] = useState<EventData[]>([]);
    const [viewMode, setViewMode] = useState<'monthly' | 'lifetime'>('monthly');

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
    const [isFiltered, setIsFiltered] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [eventsLoading, setEventsLoading] = useState(false);
    const limit = 15;

    useEffect(() => {
        if (id) {
            loadInitialData();
        }
    }, [id]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [clientData, analyticsData] = await Promise.all([
                clientService.getOne(id!),
                analyticsService.getStats(id!),
            ]);
            setClient(clientData);
            setStats(analyticsData.stats);
            setEvents(analyticsData.recentEvents || []);
            setIsFiltered(false);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFilteredData = useCallback(async () => {
        if (!startDate || !endDate) return;

        try {
            setLoading(true);
            const analyticsData = await analyticsService.getStats(id!, {
                startDate,
                endDate,
            });
            setStats(analyticsData.stats);
            setDailyBreakdown(analyticsData.dailyBreakdown || []);
            setEvents(analyticsData.recentEvents || []);
            setIsFiltered(true);
            setPage(1); // Reset to first page
        } catch (error) {
            console.error('Failed to load filtered analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [id, startDate, endDate]);

    const loadEvents = useCallback(async (pageNum: number) => {
        try {
            setEventsLoading(true);
            const params: any = { page: pageNum, limit };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (eventTypeFilter !== 'all') params.eventType = eventTypeFilter;

            const result = await analyticsService.getEvents(id!, params);
            setEvents(result.data);
            setTotalPages(result.meta.totalPages);
            setPage(pageNum);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setEventsLoading(false);
        }
    }, [id, startDate, endDate, eventTypeFilter, limit]);

    const applyFilters = () => {
        if (startDate && endDate) {
            loadFilteredData();
        }
        loadEvents(1);
    };

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setEventTypeFilter('all');
        setPage(1);
        loadInitialData();
    };

    const getStatsForView = () => {
        if (!stats) return null;
        if (isFiltered && stats.filtered) {
            return stats.filtered;
        }
        return viewMode === 'monthly' ? stats.monthly : stats.lifetime;
    };

    const currentStats = getStatsForView();

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Cargando analytics...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Analytics: {client?.name}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Rendimiento y métricas de {client?.slug}
                    </p>
                </div>
            </div>

            {/* Date Filters */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Fecha Inicio</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-10 w-44"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">Fecha Fin</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-10 w-44"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de Evento</Label>
                            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                                <SelectTrigger className="w-44">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="LEAD">Lead</SelectItem>
                                    <SelectItem value="APPOINTMENT">Cita</SelectItem>
                                    <SelectItem value="MESSAGE">Mensaje</SelectItem>
                                    <SelectItem value="HANDOFF">Handoff</SelectItem>
                                    <SelectItem value="NEW_CONVERSATION">Nueva Conv.</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={applyFilters} disabled={!startDate || !endDate}>
                            Aplicar Filtros
                        </Button>
                        {isFiltered && (
                            <Button variant="outline" onClick={clearFilters}>
                                <X className="h-4 w-4 mr-1" />
                                Limpiar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* View Mode Tabs (only when not filtered) */}
            {!isFiltered ? (
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'monthly' | 'lifetime')}>
                    <TabsList>
                        <TabsTrigger value="monthly">
                            <Activity className="h-4 w-4 mr-2" />
                            Mensual ({stats?.monthly?.month})
                        </TabsTrigger>
                        <TabsTrigger value="lifetime">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Total Histórico
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value={viewMode} className="mt-6">
                        <StatsCards stats={currentStats} />
                    </TabsContent>
                </Tabs>
            ) : (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Badge variant="secondary" className="text-sm">
                            Rango: {stats?.dateRange?.start} a {stats?.dateRange?.end}
                        </Badge>
                    </div>
                    <StatsCards stats={currentStats} />
                </div>
            )}

            {/* Daily Breakdown (only when filtered) */}
            {isFiltered && dailyBreakdown.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Desglose Diario</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-center">Leads</TableHead>
                                    <TableHead className="text-center">Citas</TableHead>
                                    <TableHead className="text-center">Mensajes</TableHead>
                                    <TableHead className="text-center">Handoffs</TableHead>
                                    <TableHead className="text-center">Nuevas Conv.</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dailyBreakdown.map((day) => (
                                    <TableRow key={day.date}>
                                        <TableCell className="font-medium">{day.date}</TableCell>
                                        <TableCell className="text-center text-green-600">{day.leads}</TableCell>
                                        <TableCell className="text-center text-blue-600">{day.appointments}</TableCell>
                                        <TableCell className="text-center text-gray-600">{day.messages}</TableCell>
                                        <TableCell className="text-center text-orange-600">{day.handoffs}</TableCell>
                                        <TableCell className="text-center text-purple-600">{day.newConversations}</TableCell>
                                        <TableCell className="text-center font-bold">{day.total}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Events Table with Pagination */}
            <Card>
                <CardHeader>
                    <CardTitle>Eventos {isFiltered ? 'Filtrados' : 'Recientes'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {eventsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                                        Cargando eventos...
                                    </TableCell>
                                </TableRow>
                            ) : events.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                                        No hay eventos {isFiltered ? 'en este rango' : 'registrados'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                events.map((event) => (
                                    <TableRow key={event.id}>
                                        <TableCell>
                                            <Badge className={`${eventTypeColors[event.eventType]} text-white`}>
                                                {eventTypeLabels[event.eventType] || event.eventType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {event.phone || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(event.createdAt).toLocaleString('es-MX', {
                                                dateStyle: 'short',
                                                timeStyle: 'short',
                                            })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-4 border-t pt-4">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (page > 1) loadEvents(page - 1); }}
                                            aria-disabled={page <= 1}
                                            className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                        />
                                    </PaginationItem>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (page <= 3) {
                                            pageNum = i + 1;
                                        } else if (page >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = page - 2 + i;
                                        }
                                        return (
                                            <PaginationItem key={pageNum}>
                                                <PaginationLink
                                                    href="#"
                                                    isActive={page === pageNum}
                                                    onClick={(e) => { e.preventDefault(); loadEvents(pageNum); }}
                                                    className="cursor-pointer"
                                                >
                                                    {pageNum}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    })}
                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (page < totalPages) loadEvents(page + 1); }}
                                            aria-disabled={page >= totalPages}
                                            className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Stats Cards Component
function StatsCards({ stats }: { stats: any }) {
    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-700">Leads</CardTitle>
                    <Users className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-green-700">{stats.leads ?? 0}</div>
                    <p className="text-xs text-green-600/70 mt-1">Eventos Lead enviados</p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700">Citas</CardTitle>
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-blue-700">{stats.appointments ?? 0}</div>
                    <p className="text-xs text-blue-600/70 mt-1">Citas agendadas</p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-gray-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-700">Mensajes</CardTitle>
                    <MessageSquare className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-gray-700">{stats.messages ?? 0}</div>
                    <p className="text-xs text-gray-600/70 mt-1">Mensajes recibidos</p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-orange-700">Handoffs</CardTitle>
                    <Phone className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-orange-700">{stats.handoffs ?? 0}</div>
                    <p className="text-xs text-orange-600/70 mt-1">Transferencias a humano</p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700">Nuevos</CardTitle>
                    <UserPlus className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-purple-700">{stats.newConversations ?? 0}</div>
                    <p className="text-xs text-purple-600/70 mt-1">Conversaciones nuevas</p>
                </CardContent>
            </Card>
        </div>
    );
}
