
export interface Backup {
    provider: string,
    region: string,
    credentials: Record<string, string>,
    providerConfig?: unknown,
}

export interface GardenBackup extends Backup {
    storageContainer?: string,
}

export interface SeedBackupConfig {
    provider: string,
    providerConfig?: unknown,
    region: string,
    secretRef: SecretRef,
}

export type SecretRef = {
    name: string,
    namespace: string,
};
