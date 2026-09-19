import { exec } from 'child_process';

export function provisionSsl(subdomain) {
  if (!subdomain) return;
  const domain = `${subdomain}.${process.env.ROOT_DOMAIN || 'streamconferences.com'}`;
  const log = `/tmp/ssl-provision-${subdomain}.log`;
  exec(`nohup /usr/local/bin/auto-ssl-streamconf.sh >> ${log} 2>&1 &`, (err) => {
    if (err) console.error(`[ssl] Failed to trigger SSL provisioning for ${domain}:`, err.message);
  });
}
