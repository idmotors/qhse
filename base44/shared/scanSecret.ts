// Secret partagé entre les workflows planifiés et les fonctions backend :
// prouve que l'appel vient du planificateur interne (aucun utilisateur connecté).
// Comparé à chaque invocation — jamais exposé côté navigateur (base44/ n'est
// jamais inclus dans le bundle frontend).
export const SCAN_CRON_SECRET = "b44-qhse-scan-9fKm3xQw7vRtE8nZ-2026";