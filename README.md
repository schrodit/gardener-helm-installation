# gardener-helm-installation
Simple Gardener installation only using helm charts

- [Prerequisites](#prerequisites)
- [Install Gardener](#install-gardener)
  - [Values/Configuration](#values) 
- [Command Options](#command-options)
- [Use as module](#use-as-module)

## Prerequisites:
1. Install node version > 16.0.0
2. Install Helm v3 https://helm.sh/docs/intro/install/
3. Install yarn `npm i -g yarn`
4. Install the node dependencies `yarn install`

## Install Gardener

1. Configure your `values.yaml`. See [Values](#values) for more details
2. Target your host cluster. (set the `KUBECONFIG` env var)
3. Run the Gardener installation with `npx ts-node index.ts --dryRun=false -f ./values.yaml --level=debug`
2. The Gardener cluster can be accessed using the kubeconfig printed in `./gen/kubeconfig`.

This gardener installer installs Gardener into a host cluster with a virtual apiserver and configures this host cluster as first initial seed.
Other configuration like shooted seeds have to be created outside of this project.

The installer will cache some data in the `gen` folder. But this folder is just for performance and saving network traffic.
So it can be safely removed.
This folder is also helpful to debug your configuration as the generated `values.yaml` for all helm charts are saved here.

The installer is idempotent and can be run multiple times without chaning the outcome.
In the future the installer will also be able to upgrade to newer Gardener versions as they are released.
In order to do so, the installer has to maintain some state.
This state is stored inside the host kubernetes cluster as secrets in the default namespace: `gardener-installer-helm-state`,  `gardener-installer-kube-apply-state`, `gardener-installer-state`.
This state includes:
- etcd certs
- virtual apiserver certs
- gardener certs
- auto generated tokens 
  - oidc client secrets
  -  gardener dashboard session secret
- all installed helm charts
- all installed manifests

:warning: The installer has only been productivly tested with:
- Host cluster: GKE | but every Kubernetes cluster with a working loadbalancer and storage integration should work.
- DNS provider: Cloudflare
- Shoot clusters: Equinix Metal

### Values
The gardener installer can be configured with a values yaml file.
The complete structure is defined in Typescript in [./src/ts/Values.ts](./src/ts/Values.ts)

```yaml
landscapeName: my-landscape

host: gardener.example.com

dns:
  provider: cloudflare-dns|google-dns|...
  credentials: # dns provider specific credentials
    apiToken: ""

hostCluster:
  provider: gcp|aws|...
  region: europe-west1
  network: # cidr's of the host cluster
    podCIDR: 10.40.0.0/14
    serviceCIDR: 10.44.0.0/20
    nodeCIDR: 10.132.0.0/20

backup: # optional, but host backupbucket has to be manually created
  provider: gcp|aws|...
  storageContainer: ""
  region: europe-west1 # region of the bucket
  credentials:
    serviceaccount.json: ""

gardener:
  initConfig:
    defaultOwner: # optional
      apiGroup: rbac.authorization.k8s.io
      kind: User
      name: adm in@example.com
    defaultMembers: # optional
      - apiGroup: rbac.authorization.k8s.io
        kind: User
        name: some-user@example.com
        role: admin

    projects: # optional
    - name: "my-project"
      description: "my first gardener project"

    cloudProfiles: # optional
      - name: "my cloudprofile"
        # cloudprofile spec.
        # See the Gardener or provider specific docs for more info: https://github.com/gardener/gardener/blob/master/example/30-cloudprofile.yaml
        spec: ~ 
          

acme:
  email: admin@example.com

# DEX indentity service that is used by the dashboard and Gardener
identity:

  dashboardClientSecret: "" # optional, will be generated
  kubectlClientSecret: "" # optional, will be generated

  staticPasswords:
  - email: admin@example.com
    hash: "" # bcrypt hashed password
    username: admin

#   additionalStaticClients: []
#   additionalSecrets: []
#   additionalVolumes: []
#   additionalVolumeMounts: []

#   connectors: []

gardener-dashboard:
  sessionSecret: "" # optional, will be generated

```

:warning: Current restrictions
- Only cloudflare dns is supported as host dns provider.
  - Support for other provider can be added here [./src/ts/components/DNS.ts](./src/ts/components/DNS.ts).
    But be ware that the gardener external dns managment as well as the cert-manager have to support the provider.
- The new DNSRecords are not used as not all dns providers like cloudlfare are supported.
- The host backup bucket has to be manually setup once and the provided in the values as `.backup.container`
- Not all extensions are currently installed.
  See the [Extension values](./extensions.yaml) for all default extensions.
  Others can be added via the values.yaml.

#### Known issues

- If the gardener dashboard is unable to correctly read the cloudprofile 
  (you are unable open the create-shoot dialog, or all versions are shown as outaded),
  then just add your host seed to the seed selector of your cloudprofile.

### Command Options

```
npx ts-node index.ts

--dryRun=false
-f [./path/to/values]
--level=[debug|info]
```

### Use as module
The gardener installer is published as npm nodule and can be used within other node scripts

```
npm i gardener-installation
```

```
yarn add gardener-installation
```

```typescript
import {Installation, InputValues} from 'gardener-installation/lib';


(async () => {

  try {

    const values: InputValues = {}

    await Installation.run({
      values,
      // dryRun: false,
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})()
```
