// Starts services for `standalone: true` using docker images from quay
const { execSync } = require('child_process');
const { NET } = require('./helpers');

async function startService(services, name, subService) {
  const args = subService.args.filter(Boolean).join(' \\\n');
  // Remove existing container
  execSync(`docker container rm --force ${name}`);

  // Wait for dependencies to start
  for (const dep of (subService.dependsOn || [])) {
    const [project, subService] = dep.split('_');
    const { startMessage } = services[project][subService];

    console.log('Waiting for', dep);
    while (!execSync(`docker logs ${dep} 2>&1`).toString().includes(startMessage)) {
      console.log('Waiting for', dep);
      await new Promise(res => setTimeout(res, 1000));
    }
    // RBAC is sad without this extra delay
    await new Promise(res => setTimeout(res, 500));
  }

  // Start container
  execSync(`docker run --name ${name} --network ${NET} --detach --pull always ${args}`);
}

function stopService(name) {
  // stop container
  console.log('stopping', name);
  execSync(`docker stop ${name}`);
}

module.exports = {
  startService,
  stopService
};
