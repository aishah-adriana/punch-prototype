const BASE = '/api';

function getToken() {
  return localStorage.getItem('auth_token');
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      req<any>('POST', '/auth/login', { username, password }),
    me: () => req<any>('GET', '/auth/me'),
    changePassword: (current_password: string, new_password: string) =>
      req<any>('PUT', '/auth/change-password', { current_password, new_password })
  },
  users: {
    list: () => req<any[]>('GET', '/users'),
    create: (data: any) => req<any>('POST', '/users', data),
    update: (id: number, data: any) => req<any>('PUT', `/users/${id}`, data),
    resetPassword: (id: number, new_password: string) =>
      req<any>('PUT', `/users/${id}/reset-password`, { new_password }),
    delete: (id: number) => req<any>('DELETE', `/users/${id}`)
  },
  subjects: {
    list: () => req<any[]>('GET', '/subjects'),
    create: (name: string) => req<any>('POST', '/subjects', { name }),
    update: (id: number, name: string) => req<any>('PUT', `/subjects/${id}`, { name }),
    delete: (id: number) => req<any>('DELETE', `/subjects/${id}`)
  },
  teachers: {
    list: () => req<any[]>('GET', '/teachers'),
    get: (id: number) => req<any>('GET', `/teachers/${id}`),
    create: (data: any) => req<any>('POST', '/teachers', data),
    update: (id: number, data: any) => req<any>('PUT', `/teachers/${id}`, data),
    delete: (id: number) => req<any>('DELETE', `/teachers/${id}`),
    setSubjects: (id: number, subject_ids: number[]) =>
      req<any>('PUT', `/teachers/${id}/subjects`, { subject_ids })
  },
  groups: {
    list: (teacherId?: number) =>
      req<any[]>('GET', `/groups${teacherId ? `?teacher_id=${teacherId}` : ''}`),
    get: (id: number) => req<any>('GET', `/groups/${id}`),
    create: (data: any) => req<any>('POST', '/groups', data),
    update: (id: number, data: any) => req<any>('PUT', `/groups/${id}`, data),
    delete: (id: number) => req<any>('DELETE', `/groups/${id}`)
  },
  students: {
    list: (params?: { teacher_id?: number; active?: number }) => {
      const qs = new URLSearchParams();
      if (params?.teacher_id) qs.set('teacher_id', String(params.teacher_id));
      if (params?.active !== undefined) qs.set('active', String(params.active));
      return req<any[]>('GET', `/students${qs.toString() ? '?' + qs : ''}`);
    },
    get: (id: number) => req<any>('GET', `/students/${id}`),
    create: (data: any) => req<any>('POST', '/students', data),
    update: (id: number, data: any) => req<any>('PUT', `/students/${id}`, data),
    deactivate: (id: number) => req<any>('DELETE', `/students/${id}`),
    setSubjects: (id: number, subject_ids: number[]) =>
      req<any>('PUT', `/students/${id}/subjects`, { subject_ids }),
    importLookup: () => req<any>('GET', '/students/import-lookup'),
    bulkImport: (students: any[]) => req<any>('POST', '/students/bulk', { students })
  },
  sessions: {
    list: (params: { teacher_id?: number; month?: number; year?: number }) => {
      const qs = new URLSearchParams();
      if (params.teacher_id) qs.set('teacher_id', String(params.teacher_id));
      if (params.month) qs.set('month', String(params.month));
      if (params.year) qs.set('year', String(params.year));
      return req<any[]>('GET', `/sessions?${qs}`);
    },
    create: (data: any) => req<any>('POST', '/sessions', data),
    updateAttendance: (id: number, attendance: any[]) =>
      req<any>('PUT', `/sessions/${id}/attendance`, { attendance }),
    delete: (id: number) => req<any>('DELETE', `/sessions/${id}`)
  },
  payments: {
    calculate: (month: number, year: number) =>
      req<any>('POST', '/payments/calculate', { month, year }),
    studentList: (month: number, year: number) =>
      req<any[]>('GET', `/payments/students?month=${month}&year=${year}`),
    markStudentPaid: (id: number, paid: boolean, notes?: string) =>
      req<{ success: boolean; receipt_id: number | null }>('PUT', `/payments/students/${id}/paid`, { paid, notes }),
    teacherList: (month: number, year: number) =>
      req<any[]>('GET', `/payments/teachers?month=${month}&year=${year}`),
    markTeacherPaid: (id: number, paid: boolean, notes?: string) =>
      req<any>('PUT', `/payments/teachers/${id}/paid`, { paid, notes }),
    summary: () => req<any>('GET', '/payments/summary'),
    studentMonthly: (student_id: number, month: number, year: number) =>
      req<any>('GET', `/payments/student-monthly?student_id=${student_id}&month=${month}&year=${year}`)
  },
  reports: {
    revenueMonthly: (month: number, year: number) =>
      req<any>('GET', `/reports/revenue/monthly?month=${month}&year=${year}`),
    revenueByTeacher: (month: number, year: number) =>
      req<any[]>('GET', `/reports/revenue/by-teacher?month=${month}&year=${year}`),
    revenueTrend: (months = 6) =>
      req<any[]>('GET', `/reports/revenue/trend?months=${months}`),
    outstanding: () => req<any>('GET', '/reports/outstanding'),
    collectionRate: () => req<any[]>('GET', '/reports/collection-rate'),
    attendanceStudents: (month: number, year: number) =>
      req<any[]>('GET', `/reports/attendance/students?month=${month}&year=${year}`),
    sessionStats: (month: number, year: number) =>
      req<any>('GET', `/reports/sessions/stats?month=${month}&year=${year}`),
    demographics: () => req<any>('GET', '/reports/students/demographics'),
    teacherPerformance: (month: number, year: number) =>
      req<any[]>('GET', `/reports/teachers/performance?month=${month}&year=${year}`),
    feesAnalysis: (month: number, year: number) =>
      req<any>('GET', `/reports/fees/analysis?month=${month}&year=${year}`),
    yearly: (year: number) => req<any>('GET', `/reports/yearly?year=${year}`),
    studentStatus: () => req<any>('GET', '/reports/students/status')
  },
  tags: {
    list: () => req<any[]>('GET', '/tags'),
    create: (data: any) => req<any>('POST', '/tags', data),
    update: (id: number, data: any) => req<any>('PUT', `/tags/${id}`, data),
    delete: (id: number) => req<any>('DELETE', `/tags/${id}`),
    getForTeacher: (teacherId: number) => req<any[]>('GET', `/tags/teacher/${teacherId}`),
    setForTeacher: (teacherId: number, tag_ids: number[]) =>
      req<any>('PUT', `/tags/teacher/${teacherId}`, { tag_ids }),
    getForStudent: (studentId: number) => req<any[]>('GET', `/tags/student/${studentId}`),
    setForStudent: (studentId: number, tag_ids: number[]) =>
      req<any>('PUT', `/tags/student/${studentId}`, { tag_ids }),
    getForSession: (sessionId: number) => req<any[]>('GET', `/tags/session/${sessionId}`),
    setForSession: (sessionId: number, tag_ids: number[]) =>
      req<any>('PUT', `/tags/session/${sessionId}`, { tag_ids }),
    getForPayment: (paymentId: number, type = 'student') =>
      req<any[]>('GET', `/tags/payment/${paymentId}?type=${type}`),
    setForPayment: (paymentId: number, tag_ids: number[], type = 'student') =>
      req<any>('PUT', `/tags/payment/${paymentId}`, { tag_ids, type })
  },
  invoices: {
    list: (params?: { student_id?: number; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.student_id) qs.set('student_id', String(params.student_id));
      if (params?.status) qs.set('status', params.status);
      return req<any[]>('GET', `/invoices?${qs}`);
    },
    get: (id: number) => req<any>('GET', `/invoices/${id}`),
    create: (data: any) => req<any>('POST', '/invoices', data),
    update: (id: number, data: any) => req<any>('PUT', `/invoices/${id}`, data),
    submit: (id: number) => req<any>('POST', `/invoices/${id}/submit`),
    share: (id: number) => req<any>('GET', `/invoices/${id}/share`),
    delete: (id: number) => req<any>('DELETE', `/invoices/${id}`),
    recurring: {
      list: () => req<any[]>('GET', '/invoices/recurring'),
      create: (data: any) => req<any>('POST', '/invoices/recurring', data),
      update: (id: number, data: any) => req<any>('PUT', `/invoices/recurring/${id}`, data),
      delete: (id: number) => req<any>('DELETE', `/invoices/recurring/${id}`),
      trigger: (id: number) => req<any>('POST', `/invoices/recurring/${id}/trigger`)
    }
  },
  receipts: {
    share: (id: number) => req<any>('GET', `/receipts/${id}/share`),
    byPayment: (paymentId: number) => req<any>('GET', `/receipts/by-payment/${paymentId}`)
  },
  teacherPortal: {
    profile: () => req<any>('GET', '/teacher-portal/profile'),
    students: () => req<any[]>('GET', '/teacher-portal/students'),
    groups: () => req<any[]>('GET', '/teacher-portal/groups'),
    sessions: (params?: { month?: number; year?: number }) => {
      const qs = new URLSearchParams();
      if (params?.month) qs.set('month', String(params.month));
      if (params?.year) qs.set('year', String(params.year));
      return req<any[]>('GET', `/teacher-portal/sessions?${qs}`);
    },
    createSession: (data: any) => req<any>('POST', '/teacher-portal/sessions', data),
    updateAttendance: (id: number, attendance: any[]) =>
      req<any>('PUT', `/teacher-portal/sessions/${id}/attendance`, { attendance }),
    deleteSession: (id: number) => req<any>('DELETE', `/teacher-portal/sessions/${id}`)
  }
};
