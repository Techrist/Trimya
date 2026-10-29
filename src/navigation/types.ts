export type RootStackParamList = {
  Onboarding: undefined;

  // Sélection de rôle — variante selon la cible de build (cf. app.config.js).
  //   - Trimya (client) : `RoleSelection` n'est plus utilisé, l'app va
  //     directement de Onboarding à PhoneSignup
  //   - Trimya Pro     : `ProRoleSelection` propose Salon vs Propriétaire
  // On garde RoleSelection dans les types pour compatibilité avec d'éventuels
  // anciens deep-links, mais l'écran n'est plus monté en Pro.
  RoleSelection: undefined;
  ProRoleSelection: undefined;

  // Client flow (Trimya uniquement)
  PhoneSignup: undefined;
  OtpVerify: { phone: string };
  ClientName: undefined;
  ClientTabs: undefined;
  ClientQr: undefined;
  ClientHistory: undefined;
  ClientBarbers: undefined;
  ClientBarberDetail: { barberId: string };
  ClientHomeRequest: { barberId: string; barberName: string };
  ClientHomeRequestDetail: { requestId: string };
  ClientHomeRequestsList: undefined;
  ClientChat: undefined;
  ClientChangePhone: undefined;
  ClientChangePhoneVerify: { phone: string };
  ClientPinSetup: undefined;
  ClientPinUnlock: undefined;

  // Salon flow (Trimya Pro uniquement)
  SalonActivation: undefined;
  SalonTabs: undefined;

  // Owner flow (Trimya Pro uniquement, plans Entreprise)
  OwnerSignIn: undefined;
  OwnerTabs: undefined;
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
  Queue: undefined;
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
  // Service à domicile — sous-section de l'onglet Réservations côté salon
  SalonHomeRequests: undefined;
  SalonHomeRequestAction: { requestId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  FullStats: undefined;
  Barbers: undefined;
  BarberForm: { barberId?: string };
  BarberStats: undefined;
};

// Owner bottom tabs
export type OwnerTabParamList = {
  OwnerHomeTab: undefined;
  OwnerSalonsTab: undefined;
  OwnerProfileTab: undefined;
};

export type OwnerSalonsStackParamList = {
  OwnerSalonsList: undefined;
  OwnerSalonDetail: { salonId: string };
  OwnerBarberTransfer: undefined;
};
