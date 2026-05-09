export type AppMode = 'client' | 'salon';

export interface Salon {
  id: string;
  name: string;
  city?: string;
  ownerName?: string;
  phone?: string;
  logo?: string;
  activationCode: string;
  activatedAt: number;
  createdAt: number;
  currency?: string;
  defaultPrice?: number;
}

export interface Barber {
  id: string;
  salonId: string;
  name: string;
  photo?: string;
  active: boolean;
  createdAt: number;
}

export interface BarberPeriodStats {
  barber: Barber;
  cutCount: number;
  rewardCount: number;
  totalAmount: number;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  photo?: string;
  salonId: string;
  currentCount: number;
  totalCuts: number;
  totalRewards: number;
  createdAt: number;
  lastVisitAt?: number;
  vip?: boolean;
  notes?: string;
  pushToken?: string;
  pushTokenUpdatedAt?: number;
  pushEnabled?: boolean;
}

export type CustomerSort = 'lastVisit' | 'progress' | 'totalCuts' | 'name';

export interface SalonStats {
  cutsToday: number;
  cutsWeek: number;
  cutsMonth: number;
  rewardsMonth: number;
  totalCustomers: number;
  vipCustomers: number;
}

export type SenderRole = 'customer' | 'salon';

export interface Conversation {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  customerPhoto?: string;
  customerVip?: boolean;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderRole: SenderRole;
  unreadByCustomer: number;
  unreadBySalon: number;
  createdAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  text: string;
  createdAt: number;
}

export type ReservationService = 'cut' | 'beard' | 'cut_beard' | 'color' | 'other';

export const RESERVATION_SERVICES: { key: ReservationService; label: string }[] = [
  { key: 'cut', label: 'Coupe' },
  { key: 'beard', label: 'Barbe' },
  { key: 'cut_beard', label: 'Coupe + barbe' },
  { key: 'color', label: 'Coloration' },
  { key: 'other', label: 'Autre' },
];

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'refused'
  | 'proposed'
  | 'cancelled'
  | 'completed';

export interface Reservation {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  service: ReservationService;
  scheduledFor: number;
  note?: string;
  status: ReservationStatus;
  proposedFor?: number;
  proposedNote?: string;
  refusedReason?: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: SenderRole;
}

export interface Cut {
  id: string;
  customerId: string;
  salonId: string;
  createdAt: number;
  wasReward: boolean;
  barberId?: string;
  barberName?: string;
  price?: number;
}

export type StatsPeriod = 'today' | 'week' | 'month' | 'all';

export interface ScanResult {
  customer: Customer;
  newCount: number;
  wasReward: boolean;
  rewardUnlocked: boolean;
}
