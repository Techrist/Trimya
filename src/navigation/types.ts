export type RootStackParamList = {
  Onboarding: undefined;
  RoleSelection: undefined;

  // Client flow
  PhoneSignup: undefined;
  OtpVerify: { phone: string };
  ClientName: undefined;
  ClientTabs: undefined;
  ClientQr: undefined;
  ClientHistory: undefined;
  ClientChat: undefined;

  // Salon flow
  SalonActivation: undefined;
  SalonTabs: undefined;
};

// Client bottom tabs
export type ClientTabParamList = {
  HomeTab: undefined;
  ReservationsTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

// Salon bottom tabs
export type SalonTabParamList = {
  ScannerTab: undefined;
  CustomersTab: undefined;
  ReservationsTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

export type ScannerStackParamList = {
  Scanner: undefined;
  AddCut: { customerId: string };
};

export type CustomersStackParamList = {
  CustomersList: undefined;
  CustomerDetail: { customerId: string };
  Chat: { customerId: string };
  ComposeNotification: { customerId: string };
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: { customerId: string };
};

// Reservations stack — used by both client and salon (different screens, same routes)
export type ReservationsStackParamList = {
  ReservationsList: undefined;
  ReservationForm: undefined;
  ReservationDetail: { reservationId: string };
  ProposeReservation: { reservationId: string };
  RefuseReservation: { reservationId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  FullStats: undefined;
  Barbers: undefined;
  BarberForm: { barberId?: string };
  BarberStats: undefined;
};
