import { execSync } from 'child_process';
import { Plugin } from 'vite';
import { writeFileSync } from 'fs';

export function versionPlugin(): Plugin {
  return {
    name: 'version-generator',
    buildStart() {
      let commit = 'unknown';
      try {
        commit = execSync('git rev-parse --short HEAD').toString().trim();
      } catch {}

      function formatDate(date: Date) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      }

      const buildDate = formatDate(new Date());
      const content = `// This file is auto-generated. Do not edit directly.
export const VERSION = {
  commitHash: "${commit}",
  buildDate: "${buildDate}"
};
`;
      
      writeFileSync('src/version.ts', content);
      console.log(`Generated version.ts with commit ${commit} and build date ${buildDate}`);
    }
  };
}
