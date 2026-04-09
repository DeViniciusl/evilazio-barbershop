/**
 * Shared Configuration for Client
 * Used by HTML pages to validate and display service information
 * This mirrors the SERVICE_DURATIONS and SERVICE_PRICES from server.js
 */

const SERVICES_CONFIG = {
  corte_social: {
    name: "Corte Social",
    displayName: "Corte Social",
    duration: 30,
    price: 35,
    description: "Visual clássico e alinhado para rotina profissional.",
  },
  corte_tradicional: {
    name: "Corte Tradicional",
    displayName: "Corte Tradicional",
    duration: 30,
    price: 35,
    description: "Corte clássico com acabamento impecável.",
  },
  corte_degrade: {
    name: "Corte Degradê",
    displayName: "Corte Degradê",
    duration: 35,
    price: 40,
    description: "Transição precisa com acabamento moderno.",
  },
  corte_navalhado: {
    name: "Corte Navalhado",
    displayName: "Corte Navalhado",
    duration: 40,
    price: 45,
    description: "Acabamento premium com navalha.",
  },
  barba: {
    name: "Barba",
    displayName: "Barba",
    duration: 15,
    price: 20,
    description: "Aparação e alinhamento de barba.",
  },
  sobrancelha: {
    name: "Sobrancelha",
    displayName: "Sobrancelha",
    duration: 10,
    price: 15,
    description: "Limpeza e design de sobrancelha.",
  },
  pezinho: {
    name: "Pezinho",
    displayName: "Pezinho",
    duration: 20,
    price: 20,
    description: "Aparação frontal premium.",
  },
  corte_barba: {
    name: "Corte + Barba",
    displayName: "Corte + Barba",
    duration: 45,
    price: 55,
    description: "Corte completo com barba.",
  },
  corte_barba_sobrancelha: {
    name: "Corte + Barba + Sobrancelha",
    displayName: "Corte + Barba + Sobrancelha",
    duration: 50,
    price: 65,
    description: "Pacote completo de grooming.",
  },
};

// Quick lookup maps
const SERVICE_DURATIONS = Object.entries(SERVICES_CONFIG).reduce((acc, [key, config]) => {
  acc[key] = config.duration;
  return acc;
}, {});

// Helper functions
function getServiceDuration(serviceKey) {
  return SERVICE_DURATIONS[serviceKey] || null;
}

function getServiceConfig(serviceKey) {
  return SERVICES_CONFIG[serviceKey] || null;
}

function getServiceDisplayName(serviceKey) {
  return SERVICES_CONFIG[serviceKey]?.displayName || serviceKey;
}

function getAllServices() {
  return Object.entries(SERVICES_CONFIG).map(([key, config]) => ({
    key,
    ...config,
  }));
}
