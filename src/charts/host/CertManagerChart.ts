import { Chart, RemoteChart, Values } from "../../ts/plugins/Helm";
import { GardenSystemNamespace, GeneralValues } from "../../ts/Values";


export class CertManagerChart extends Chart {
    constructor() {
        super(
            'cert-manager',
            new RemoteChart(
                'cert-manager',
                'v1.7.1',
                'https://charts.jetstack.io',
            ),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            installCRDs: true,
        };
    }
}