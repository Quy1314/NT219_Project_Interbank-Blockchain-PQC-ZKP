# Windows Apache + OpenSSL 3.6 + TLS 1.3 + Post‑Quantum (ML‑KEM, ML‑DSA)

> **Goal**: Run Apache HTTP Server on Windows with OpenSSL 3.6, using a **self‑signed ML‑DSA CA**, an **ML‑DSA server certificate**, and **TLS 1.3** with **hybrid post‑quantum key exchange groups** (ML‑KEM + X25519).
>
> This is a **lab‑style configuration** aimed at teaching PQC + TLS, not a production hardening guide.

---

## 0. Lab Topology & Assumptions

- OS: Windows 10/11 (Command Prompt `cmd.exe`)
- Apache: Installed under `C:\Apache24` (Apache Lounge layout)
- OpenSSL 3.6 PQ build: `openssl.exe` in `D:\cryptobcu\openssl360\msvc\bin`
- Apache is linked against this OpenSSL 3.6 (or a binary‑compatible build)
- You are comfortable editing:
  - `C:\Apache24\conf\httpd.conf`
  - `C:\Apache24\conf\extra\httpd-ssl.conf` (or a new PQC‑specific file)

### 0.1. Put OpenSSL 3.6 PQ build in PATH

```bat
:: Use your real path to OpenSSL 3.6
set "OPENSSL_ROOT=D:\cryptobcu\openssl360\msvc"
set "PATH=%OPENSSL_ROOT%\bin;%PATH%"

openssl version -a
```

Check that:

- Version is `OpenSSL 3.6.x ...`.
- `OPENSSLDIR` and `ENGINESDIR` look correct.

We will use **this** `openssl.exe` for all CA/TLS operations.

---

## 1. Verify PQC Algorithms & TLS 1.3 Groups

Before touching Apache, confirm that your OpenSSL build actually exposes the PQ algorithms.

### 1.1. Public‑key algorithms

```bat
openssl list -public-key-algorithms
```

Look for entries such as:

- `ML-DSA-44`, `ML-DSA-65`, `ML-DSA-87` (or similar names like `MLDSA65`)
- Classical algorithms: `RSA`, `EC`, `X25519`, `ED25519`, …

### 1.2. KEM algorithms (ML‑KEM)

```bat
openssl list -kem-algorithms
```

You should see at least:

- `ML-KEM-512`
- `ML-KEM-768`
- `ML-KEM-1024`

### 1.3. TLS 1.3 groups (classical + hybrid PQ)

```bat
openssl list -tls-groups -tls1_3
```

Expected groups include:

- Classical: `X25519`, `secp256r1` / `prime256v1`, `X448`, `ffdheXXXX`, …
- Hybrid PQ: `X25519MLKEM768`, `SecP256r1MLKEM768`, `SecP384r1MLKEM1024`

If these hybrid groups are missing, your OpenSSL build does **not** have TLS‑integrated ML‑KEM support; the Apache PQ TLS step will not work as written.

### 1.4. Providers

```bat
openssl list -providers -verbose
```

Check that:

- The `default` provider is loaded.
- Any additional PQ provider (if you use one) is loaded as well.

---

## 2. Build a Minimal PQ‑CA Directory on Windows

We’ll create a classical OpenSSL CA structure, but use **ML‑DSA** keys.

### 2.1. Create directories

```bat
mkdir C:\crypto\pqc-ca
cd /d C:\crypto\pqc-ca

mkdir certs crl newcerts private

:: CA database files
copy NUL index.txt >NUL
copy NUL index.txt.attr >NUL

:: First serial number
echo 1000> serial
```

Directory layout (after this step):

```text
C:\crypto\pqc-ca\
  certs\
  crl\
  newcerts\
  private\
  index.txt
  index.txt.attr
  serial
```

---

## 3. PQ‑Enabled `openssl.cnf` for CA & Server Certs

Create `C:\crypto\openssl-pqc-ca.cnf` with the following content (adjust names as you like):

```ini
# C:\crypto\openssl-pqc-ca.cnf

[ ca ]
default_ca = CA_default

[ CA_default ]
# Root directory of this CA
 dir               = C:/crypto/pqc-ca
 certs             = $dir/certs
 crl_dir           = $dir/crl
 new_certs_dir     = $dir/newcerts
 database          = $dir/index.txt
 serial            = $dir/serial

 private_key       = $dir/private/root_ca_mldsa.key
 certificate       = $dir/certs/root_ca_mldsa.crt

 default_md        = sha512
 default_days      = 3650

 policy            = policy_loose
 x509_extensions   = v3_ca
 copy_extensions   = copy

[ policy_loose ]
 commonName              = supplied
 countryName             = optional
 stateOrProvinceName     = optional
 organizationName        = optional
 organizationalUnitName  = optional
 emailAddress            = optional

[ req ]
 default_bits        = 3072         # not used by ML-DSA, kept for compatibility
 default_md          = sha512
 distinguished_name  = req_dn
 x509_extensions     = v3_ca
 prompt              = yes

[ req_dn ]
 countryName         = Country Name (2 letter code)
 countryName_default = VN

 stateOrProvinceName         = State or Province Name
 stateOrProvinceName_default = HCMC

 organizationName         = Organization Name
 organizationName_default = IUH Lab

 commonName         = Common Name
 commonName_default = PQ Root CA ML-DSA-65

[ v3_ca ]
 basicConstraints        = critical,CA:TRUE
 keyUsage                = critical,keyCertSign,cRLSign
 subjectKeyIdentifier    = hash
 authorityKeyIdentifier  = keyid:always,issuer

[ server_cert ]
 basicConstraints        = CA:FALSE
 keyUsage                = critical,digitalSignature,keyEncipherment
 extendedKeyUsage        = serverAuth
 subjectKeyIdentifier    = hash
 authorityKeyIdentifier  = keyid,issuer
 subjectAltName          = @alt_names

[ alt_names ]
 DNS.1 = localhost
 DNS.2 = www.pqc-lab.local
```

Notes:

- This config is **classical** OpenSSL CA layout; the fact that we use **ML‑DSA** keys comes from the commands, not from the config file.
- `server_cert` + `alt_names` will be used when issuing the Apache server certificate.

---

## 4. Create an ML‑DSA Root CA (Self‑Signed)

Now use ML‑DSA‑65 as the root CA key type.

### 4.1. Generate ML‑DSA root CA key

```bat
cd /d C:\crypto\pqc-ca

openssl genpkey -algorithm ML-DSA-65 ^
    -out private\root_ca_mldsa.key
```

If `ML-DSA-65` fails, first check the exact algorithm name from `openssl list -public-key-algorithms` and adapt (e.g. `MLDSA65`).

### 4.2. Self‑signed ML‑DSA root certificate

```bat
openssl req -new -x509 ^
    -config C:\crypto\openssl-pqc-ca.cnf ^
    -key private\root_ca_mldsa.key ^
    -out certs\root_ca_mldsa.crt ^
    -days 3650
```

During the prompts, you can accept defaults or set a more descriptive CN, e.g.:

- `Common Name = PQ Root CA ML-DSA-65`

### 4.3. Inspect the root CA certificate

```bat
openssl x509 -in certs\root_ca_mldsa.crt -text -noout
```

Check:

- Signature algorithm is something like `ml-dsa-65` (or similar PQ naming).
- `Basic Constraints: CA:TRUE` is present.

This is your **Self CA**.

---

## 5. Issue an ML‑DSA Server Certificate for Apache

### 5.1. Generate server ML‑DSA key

```bat
cd /d C:\crypto\pqc-ca

openssl genpkey -algorithm ML-DSA-65 ^
    -out private\server_mldsa.key
```

### 5.2. Create server CSR (with SANs)

We reuse the same config file and the `server_cert` / `alt_names` extensions.

```bat
openssl req -new ^
    -config C:\crypto\openssl-pqc-ca.cnf ^
    -key private\server_mldsa.key ^
    -out server_mldsa.csr
```

At the prompt:

- `Common Name` → set to the hostname you’ll use, e.g. `localhost` or `www.pqc-lab.local`.

The SANs are taken from `[ alt_names ]` in the config.

### 5.3. Sign the CSR with the ML‑DSA CA

```bat
openssl ca -batch ^
    -config C:\crypto\openssl-pqc-ca.cnf ^
    -in server_mldsa.csr ^
    -out certs\server_mldsa.crt ^
    -extensions server_cert ^
    -days 825
```

Check `certs\server_mldsa.crt`:

```bat
openssl x509 -in certs\server_mldsa.crt -text -noout
```

You should see:

- Issuer = your PQ Root CA
- Subject = your server CN
- `X509v3 extensions:` with `serverAuth` and SANs.

### 5.4. Build a simple certificate chain file for Apache

Apache usually prefers the **server certificate + intermediates** in a single file. Here we only have a root CA, so we can build a 2‑cert chain (server + root):

```bat
cd /d C:\crypto\pqc-ca

copy /b certs\server_mldsa.crt + certs\root_ca_mldsa.crt ^
    certs\server_mldsa_chain.crt
```

You now have:

- `private\server_mldsa.key` – ML‑DSA server private key
- `certs\server_mldsa_chain.crt` – server cert + root CA
- `certs\root_ca_mldsa.crt` – root CA (for clients)

---

## 6. Install PQ Certificates into Apache on Windows

### 6.1. Create an SSL directory for Apache

```bat
mkdir C:\Apache24\conf\ssl

copy C:\crypto\pqc-ca\private\server_mldsa.key       C:\Apache24\conf\ssl\
copy C:\crypto\pqc-ca\certs\server_mldsa_chain.crt   C:\Apache24\conf\ssl\
copy C:\crypto\pqc-ca\certs\root_ca_mldsa.crt        C:\Apache24\conf\ssl\
```

Now Apache sees:

- `C:\Apache24\conf\ssl\server_mldsa.key`
- `C:\Apache24\conf\ssl\server_mldsa_chain.crt`
- `C:\Apache24\conf\ssl\root_ca_mldsa.crt`

### 6.2. Enable SSL module and include an SSL config

Edit `C:\Apache24\conf\httpd.conf` and ensure the following lines are **uncommented**:

```apache
LoadModule ssl_module modules/mod_ssl.so
LoadModule socache_shmcb_module modules/mod_socache_shmcb.so

# You can use the default or your own SSL config file
Include conf/extra/httpd-ssl-pqc.conf
```

We will create `httpd-ssl-pqc.conf` as a **PQC‑focused** TLS 1.3 virtual host.

---

## 7. Apache TLS 1.3 + PQC Virtual Host Config

Create `C:\Apache24\conf\extra\httpd-ssl-pqc.conf`:

```apache
Listen 443

<VirtualHost _default_:443>
    ServerName localhost:443

    DocumentRoot "C:/Apache24/htdocs"
    ServerAdmin you@example.com

    SSLEngine on

    # --- Protocol selection: TLS 1.3 only for this lab ---
    SSLProtocol -all +TLSv1.3

    # TLS 1.3 cipher suites (PQC is in key exchange, not here)
    SSLCipherSuite TLSv1.3 \
        TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256

    # --- PQC ML-DSA certificate ---
    SSLCertificateFile      "C:/Apache24/conf/ssl/server_mldsa_chain.crt"
    SSLCertificateKeyFile   "C:/Apache24/conf/ssl/server_mldsa.key"

    # Root CA for client validation (optional, good for s_client tests)
    SSLCACertificateFile    "C:/Apache24/conf/ssl/root_ca_mldsa.crt"

    # --- Hybrid PQ key exchange groups (TLS 1.3) ---
    # Prefer hybrid X25519+ML-KEM-768, then classical groups
    SSLOpenSSLConfCmd Groups X25519MLKEM768:x25519:prime256v1

    # Logging just for this PQC vhost
    ErrorLog  "logs/pqc-ssl-error.log"
    CustomLog "logs/pqc-ssl-access.log" combined
</VirtualHost>
```

Key points:

- `SSLProtocol -all +TLSv1.3` ensures this vhost only uses TLS 1.3.
- `SSLOpenSSLConfCmd Groups ...` controls **TLS groups / KEMs**; we put `X25519MLKEM768` first so that if the client supports it, the handshake uses the **hybrid PQ KEM**.
- PQC is **not** visible in `SSLCipherSuite` (those are still AES‑GCM / CHACHA20); PQC is in the key exchange (KEM groups).

If Apache fails to start and logs an error about `SSLOpenSSLConfCmd Groups`, double‑check:

- Apache really uses OpenSSL 3.5+ / 3.6.
- The group name spelling matches `openssl list -tls-groups -tls1_3` output (e.g., try lowercase `x25519mlkem768`).

---

## 8. Restart Apache and Validate Config

From an **elevated** Command Prompt (or wherever you run Apache):

```bat
cd /d C:\Apache24\bin

httpd.exe -t
```

You should see `Syntax OK`. Then restart Apache:

```bat
httpd.exe -k restart
```

If Apache is installed as a service, use:

```bat
httpd.exe -k restart -n "Apache24"
```

Check `logs\pqc-ssl-error.log` if anything fails.

---

## 9. Testing TLS 1.3 + ML‑KEM Hybrid with `openssl s_client`

We’ll use the same OpenSSL 3.6 CLI to connect to Apache and inspect the negotiated group.

### 9.1. Test with TLS 1.3 and hybrid PQ group

```bat
cd /d %OPENSSL_ROOT%\bin

:: -groups sets the client-supported groups; put X25519MLKEM768 first

echo Q | openssl s_client ^
    -connect localhost:443 ^
    -tls1_3 ^
    -groups X25519MLKEM768:x25519:prime256v1 ^
    -CAfile C:\Apache24\conf\ssl\root_ca_mldsa.crt
```

In the output, look for lines near the bottom like:

```text
SSL-Session:
    Protocol  : TLSv1.3
    ...
    Group     : X25519MLKEM768
    ...
    Verify return code: 0 (ok)
```

This shows:

- TLS 1.3 was negotiated.
- The key exchange group is **hybrid X25519 + ML‑KEM‑768**.
- The certificate chain validated against your ML‑DSA CA.

### 9.2. Force classical X25519 for comparison

```bat
echo Q | openssl s_client ^
    -connect localhost:443 ^
    -tls1_3 ^
    -groups x25519:prime256v1 ^
    -CAfile C:\Apache24\conf\ssl\root_ca_mldsa.crt
```

Now the `Group` line should show `X25519` (classical ECDH only). Use this to demonstrate the difference between classical and hybrid PQ handshakes.

### 9.3. Browser testing (optional)

- Import `root_ca_mldsa.crt` into your browser’s **Trusted Root Certification Authorities** store.
- Visit `https://localhost/`.
- Whether PQ key exchange is used depends on whether the browser + OS TLS stack support `X25519MLKEM768`. For teaching, `openssl s_client` is the most reliable way to demonstrate PQ.

---

## 10. Notes on ML‑DSA Certificates in TLS

- **Server authentication**: In this lab, both the **CA** and **server** use ML‑DSA keys and signatures.
- **Client support**: At the moment, most mainstream TLS stacks are still experimenting with PQ signatures. Your TLS client (browser or library) must understand ML‑DSA to verify the certificate chain.
  - If a client does **not** support ML‑DSA signatures, it will fail the handshake regardless of the ML‑KEM key exchange.
- For **maximum compatibility**, you can deploy **two virtual hosts** on Apache:
  1. A classical RSA/ECDSA vhost (for normal clients).
  2. This ML‑DSA + ML‑KEM vhost (for lab experiments with PQ‑enabled clients).

---

## 11. Optional: Dual‑Stack vhosts (Classical + PQC)

A common teaching pattern is:

- `https://classic.local/` → RSA/ECDSA cert, classical groups.
- `https://pqc.local/` → ML‑DSA cert, PQ groups first.

Sketch:

```apache
<VirtualHost *:443>
    ServerName classic.local
    SSLEngine on
    SSLProtocol -all +TLSv1.2 +TLSv1.3

    # Classical RSA/ECDSA certificates here
    SSLCertificateFile    "C:/Apache24/conf/ssl/server_classic_chain.crt"
    SSLCertificateKeyFile "C:/Apache24/conf/ssl/server_classic.key"

    # Classical groups only
    SSLOpenSSLConfCmd Groups x25519:prime256v1
</VirtualHost>

<VirtualHost *:443>
    ServerName pqc.local
    SSLEngine on
    SSLProtocol -all +TLSv1.3

    # ML-DSA server certificate here
    SSLCertificateFile    "C:/Apache24/conf/ssl/server_mldsa_chain.crt"
    SSLCertificateKeyFile "C:/Apache24/conf/ssl/server_mldsa.key"

    # Hybrid PQ groups first
    SSLOpenSSLConfCmd Groups X25519MLKEM768:x25519:prime256v1
</VirtualHost>
```

This allows you to show, side‑by‑side, how different clients negotiate classical vs PQ handshakes.

---

## 12. Mapping Back to the CLI Lab (Conceptual View)

- **Section 1 (Algorithm discovery)** → used here to choose the exact names `ML-DSA-65`, `ML-KEM-768`, `X25519MLKEM768`.
- **Section 6 (ML‑DSA signatures)** → the same key type is now used for **CA** and **server** keys; TLS uses those for certificate‑based authentication.
- **Section 7 (ML‑KEM KEM)** → instead of calling `pkeyutl -encap/-decap` yourself, TLS 1.3 performs an ML‑KEM KEM under the hood whenever a hybrid group like `X25519MLKEM768` is selected.

So the lab naturally extends from **stand‑alone PQ primitives**:

- ML‑DSA (`genpkey`, `pkeyutl -sign/-verify`)
- ML‑KEM (`pkeyutl -encap/-decap`)

into a **full TLS 1.3 + Apache deployment** where:

- ML‑KEM provides **post‑quantum confidentiality** of the session keys.
- ML‑DSA provides **post‑quantum authentication** via your PQC CA and server certificate.

