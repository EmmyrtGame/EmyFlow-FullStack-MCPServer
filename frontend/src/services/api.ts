import axios from 'axios';

const api = axios.create({
  baseURL: '/api/admin',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Window redirect might be too aggressive if used in components, 
      // but for admin panel it's often acceptable. 
      // Ideally handled by AuthContext but this is a failsafe.
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const clientService = {
  getAll: () => api.get('/clients').then(res => res.data),
  getOne: (id: string) => api.get(`/clients/${id}`).then(res => res.data),
  create: (data: any) => api.post('/clients', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/clients/${id}`).then(res => res.data),
  uploadServiceAccount: (clientId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/clients/${clientId}/service-account`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => res.data);
  }
};

export default api;
