import type { InvitationData } from "./schema";

const typical: InvitationData = {
  parentsOne: ["Osvaldo Carmona Morales", "Marcela Redard Ayala"],
  parentsTwo: ["Álvaro Galán Díaz", "Paula Piazzano Zamorano"],
  couple: { partnerOne: "Álvaro Galán Piazzano", partnerTwo: "Francisca Carmona Redard" },
  ceremony: {
    description:
      "Ceremonia religiosa que se efectuará con misa de precepto en la Capilla del Colegio Cumbres",
    address: "Av. La Plaza 1150, Las Condes",
    date: "2027-03-13",
    time: "16:45",
  },
  party: {
    venue: "Centro de Eventos Arboleda Chicureo",
    address: "Alba 1 / 11640, Chicureo, Colina",
    time: "22:00",
  },
  rsvp: { phones: ["+56 9 8299 5134", "+56 9 8134 7187"], email: "familiagalancarmona@example.cl" },
  issuedAt: { city: "Santiago", label: "enero 2027" },
  venueMapUrl: "https://waze.com/ul?q=Arboleda%20Chicureo",
  giftRegistry: { label: "Novios Falabella - Código 2104134", url: "https://www.falabella.com/novios" },
  envelopeAddress: "Camino del Manzanar 11843, Las Condes",
};

const minimal: InvitationData = {
  parentsOne: ["Juan Pérez"],
  parentsTwo: ["Rosa Soto"],
  couple: { partnerOne: "Ana Pérez", partnerTwo: "Luis Soto" },
  ceremony: {
    description: "Ceremonia civil",
    address: "Registro Civil, Providencia",
    date: "2027-01-09",
    time: "12:00",
  },
  rsvp: { phones: ["+56 9 1111 2222"] },
  issuedAt: { city: "Santiago", label: "diciembre 2026" },
};

const extreme: InvitationData = {
  parentsOne: ["María Begoña Ñúñez de la Fuente-O'Higgins", "José Ignacio Müller Undurraga Echeñique"],
  parentsTwo: ["Ana María Güemes Larraín de Castro", "Íñigo Peña y Lillo Ossandón Errázuriz"],
  couple: {
    partnerOne: "María José Begoña Ñúñez de la Fuente-O'Higgins",
    partnerTwo: "Juan Ignacio Müller Güemes Peña y Lillo",
  },
  ceremony: {
    description:
      "Ceremonia religiosa que se celebrará con misa solemne en la Parroquia Nuestra Señora de los Ángeles de Peñalolén, con la bendición de ambas familias",
    address: "Avenida Presidente Kennedy Lateral 9.350, Departamento 1204, Vitacura",
    date: "2027-12-31",
    time: "19:30",
  },
  party: {
    venue: "Club de Campo y Centro de Eventos Viña Santa Rita de Alto Jahuel",
    address: "Camino Padre Hurtado 0695, Alto Jahuel, Buin, Región Metropolitana",
    time: "21:15",
  },
  rsvp: { phones: ["+56 9 9999 8888", "+56 9 7777 6666", "+56 2 2345 6789"], email: "rsvp.nunez.muller@example.cl" },
  issuedAt: { city: "Santiago de Chile", label: "septiembre de 2027" },
  venueMapUrl: "https://maps.example.cl/?q=Vi%C3%B1a%20Santa%20Rita",
  giftRegistry: { label: "Lista de regalos París - Código 9988776655 - Novios Ñúñez Müller", url: "https://www.paris.cl/novios" },
  envelopeAddress: "Los Dominicos 7.890, Casa 14, Condominio Los Peñascos, Las Condes",
};

export const fixtures = { typical, minimal, extreme } as const;
