export type Role = "manager" | "technician" | "customer";

export interface OwnerTechnician {
  id: string;
  name: string;
  phone?: string;
}

export interface AssignedTechnician {
  id: string;
  name: string;
  phone?: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
  technicians: OwnerTechnician[];
  createdAt: string;
}

export interface Template {
  id: string;
  ownerId: string;
  name: string;
  tasks: string[];
  createdAt: string;
}

export interface JobTask {
  id: string;
  name: string;
  completed: boolean;
  updatedAt: string;
}

export interface JobNoteEntry {
  id: string;
  authorName: string;
  authorTechnicianId?: string;
  message: string;
  createdAt: string;
}

export interface Job {
  id: string;
  ownerId: string;
  title: string;
  businessName: string;
  customerName: string;
  customerPhone?: string;
  location: string;
  businessPhone: string;
  assignedTechnician: AssignedTechnician | null;
  noteEntries: JobNoteEntry[];
  tasks: JobTask[];
  technicianToken: string;
  customerToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreData {
  owners: Owner[];
  templates: Template[];
  jobs: Job[];
}

export interface CreateOwnerInput {
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
}

export interface UpdateOwnerInput {
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
  technicians?: OwnerTechnician[];
}

export interface CreateTemplateInput {
  ownerId: string;
  name: string;
  tasks: string[];
}

export interface CreateJobInput {
  ownerId: string;
  title: string;
  customerName: string;
  customerPhone?: string;
  location: string;
  assignedTechnicianId?: string;
  tasks: string[];
}

export interface JobSession {
  id: string;
  title: string;
  businessName: string;
  customerName: string;
  customerPhone?: string;
  location: string;
  businessPhone: string;
  assignedTechnician: AssignedTechnician | null;
  noteEntries: JobNoteEntry[];
  tasks: JobTask[];
  updatedAt: string;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  allCompleted: boolean;
}
