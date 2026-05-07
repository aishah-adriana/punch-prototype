export interface Subject {
  id: number;
  name: string;
  student_count?: number;
  teacher_count?: number;
}

export interface Teacher {
  id: number;
  name: string;
  phone: string;
  email: string;
  student_count?: number;
  subjects?: Subject[];
  created_at?: string;
}

export interface ClassGroup {
  id: number;
  name: string;
  teacher_id: number;
  teacher_name?: string;
  syllabus: string;
  duration_hours: number;
  student_count?: number;
  students?: Student[];
}

export interface Student {
  id: number;
  name: string;
  age: number;
  syllabus: 'KSSR' | 'KSSM' | 'Cambridge';
  class_type: '1on1' | 'group';
  teacher_id: number;
  teacher_name?: string;
  group_id?: number;
  group_name?: string;
  active: number;
  subjects?: Subject[];
}

export interface AttendanceRecord {
  id: number;
  session_id: number;
  student_id: number;
  student_name?: string;
  attended: number;
}

export interface Session {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  student_id?: number;
  student_name?: string;
  group_id?: number;
  group_name?: string;
  session_date: string;
  duration_hours: number;
  class_type: '1on1' | 'group';
  month: number;
  year: number;
  notes: string;
  attendance?: AttendanceRecord[];
}

export interface StudentPayment {
  id: number;
  student_id: number;
  student_name?: string;
  teacher_name?: string;
  group_name?: string;
  syllabus?: string;
  class_type?: string;
  month: number;
  year: number;
  classes_count: number;
  duration_hours: number;
  hourly_rate: number;
  tuition_fee: number;
  material_fee: number;
  total_due: number;
  paid: number;
  paid_date?: string;
  notes: string;
}

export interface TeacherPayment {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  month: number;
  year: number;
  total_tuition_fee: number;
  collaboration_fee: number;
  material_fee: number;
  net_pay: number;
  paid: number;
  paid_date?: string;
  notes: string;
}

export interface DashboardSummary {
  totalStudents: number;
  totalTeachers: number;
  unpaidStudents: number;
  unpaidTeachers: number;
  sessionsThisMonth: number;
  totalDue: number;
  totalCollected: number;
  month: number;
  year: number;
}
