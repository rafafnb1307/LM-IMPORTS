// ═══════════════════════════════════════════════════════
//  NVST Tech — Config de URLs
//  Edite APENAS este arquivo para apontar para o seu VPS
// ═══════════════════════════════════════════════════════

const NVST = {
    // URL base da API no seu VPS (com https://)
    // Exemplo: 'https://nvsttech.com.br'
    //      ou: 'https://minha-vps.com'
    VPS: 'https://nvst-tech.vercel.app',

    // Montado automaticamente — não precisa editar
    get API()  { return this.VPS + '/api/monitor.php'; },
    get KEYS() { return this.VPS + '/api/keys.php';    },
};
