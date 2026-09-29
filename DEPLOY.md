# Deploying Smart Restaurant on AWS (EC2 + Docker Compose)

This is the simplest path: one EC2 virtual machine running all four containers
(`mongo`, `ml`, `server`, `client`) via `docker-compose.yml`. Good for a demo /
graduation presentation. For a "production" setup see the notes at the bottom.

---

## 0. One-time project cleanup (do this first, locally)

The repo currently commits `Server/.env`, which contains a real `JWT_SECRET`
and an **OpenAI API key**. Before deploying anywhere:

```bash
# 1. Revoke the leaked OpenAI key in the OpenAI dashboard, create a new one.
# 2. Stop tracking the env file:
git rm --cached Server/.env
git commit -m "chore: stop tracking Server/.env (secrets)"
```

`.gitignore` already ignores `.env*`, so it won't be re-added. Keep your local
`Server/.env` for `npm run dev`; the Docker setup doesn't use it.

---

## 1. Launch an EC2 instance

1. AWS Console → **EC2** → **Launch instance**.
2. Name: `smart-restaurant`.
3. AMI: **Ubuntu Server 22.04 LTS** (x86_64).
4. Instance type: **t3.small** minimum (2 GB RAM). The ML image
   (`prophet` / `statsmodels`) needs headroom — `t2.micro` will OOM during build.
   `t3.medium` is comfortable.
5. Key pair: create/download one (`smart-restaurant.pem`) — you'll SSH with it.
6. Network settings → **Security group** — allow inbound:
   - **SSH (22)** from *My IP*
   - **HTTP (80)** from *Anywhere* (0.0.0.0/0)
   - (optional) **Custom TCP 5173** from *Anywhere* if you don't map to port 80
7. Storage: bump to **20 GB** (Docker images are chunky).
8. Launch.

## 2. Connect & install Docker

```bash
chmod 400 smart-restaurant.pem
ssh -i smart-restaurant.pem ubuntu@<EC2_PUBLIC_IP>

# on the instance:
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu
exit            # log out & back in so the group change takes effect
ssh -i smart-restaurant.pem ubuntu@<EC2_PUBLIC_IP>
docker --version && docker compose version   # verify
```

## 3. Get the code onto the instance

```bash
git clone <your-repo-url> smart-restaurant
cd smart-restaurant
```

(If the repo is private: use a GitHub deploy key or a personal access token.)

## 4. Configure secrets

```bash
cp .env.docker.example .env
nano .env
```

Set:

```env
JWT_SECRET=<paste a long random string>     # e.g. `openssl rand -hex 32`
OPENAI_API_KEY=<your new key, or leave blank>
CLIENT_PORT=80                              # serve the UI on the standard port
```

## 5. Build & start everything

```bash
docker compose up -d --build
```

First build takes ~5–10 min (the Python ML image compiles native deps).
Check status:

```bash
docker compose ps
docker compose logs -f server     # Ctrl-C to stop following
```

## 6. Seed the database (first run only)

```bash
docker compose exec server npm run seed
docker compose exec server npm run seed:ai-engine   # optional extra AI data
```

The base seed prints/creates the default admin login — see
`Server/src/infrastructure/config/seed.js`.

## 7. Open the app

`http://<EC2_PUBLIC_IP>/` — log in with the seeded admin credentials.

The browser only talks to that one origin; the nginx container proxies
`/api/*` to the `server` container, which talks to `ml` and `mongo` over the
internal Docker network. Nothing else is exposed publicly.

## 8. Updating after a code change

```bash
ssh ... ; cd smart-restaurant
git pull
docker compose up -d --build
```

## 9. Stopping / cleanup

```bash
docker compose down          # stop containers, keep the DB volume
docker compose down -v       # also delete the MongoDB data
```

Then **terminate the EC2 instance** in the console when you're done so it stops
costing money.

---

## Optional niceties

- **Domain + HTTPS:** point a domain at the instance's Elastic IP, then put
  Caddy or nginx-proxy + Let's Encrypt in front of port 80. Or use AWS
  Application Load Balancer + ACM certificate.
- **Elastic IP:** allocate one and associate it so the public IP survives a
  stop/start.
- **Managed Mongo:** swap the `mongo` service for **MongoDB Atlas** (free M0
  tier) and set `MONGO_URI` in `.env` to the Atlas connection string — drop the
  `mongo` service and its `depends_on` entries.

## "Production" alternative (more work, more robust)

- Push the three images to **Amazon ECR**.
- Run them on **ECS Fargate** (no servers to manage) behind an **ALB**.
- Use **MongoDB Atlas** or **Amazon DocumentDB** for the database.
- Store `JWT_SECRET` / `OPENAI_API_KEY` in **AWS Secrets Manager**.
- Serve the React build from **S3 + CloudFront** instead of the nginx container.

Overkill for a graduation demo, but that's the path if you need it to scale.
