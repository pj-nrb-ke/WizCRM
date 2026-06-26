import cron from 'node-cron';
import { prisma } from '../../../lib/prisma.js';
import { runHeatMapDiscovery } from './heat-map.service.js';

// Runs every Monday at 07:00 EAT (East Africa Time = UTC+3)
// cron timezone: 'Africa/Nairobi'
const SCHEDULE = '0 7 * * 1';

export function startHeatMapScheduler() {
  cron.schedule(
    SCHEDULE,
    async () => {
      console.log('[Scheduler] Weekly heat map scan starting…');
      try {
        const campaigns = await prisma.campaign.findMany({
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            industryKeywords: true,
            locations: true,
          },
        });

        console.log(`[Scheduler] Found ${campaigns.length} active campaign(s) to scan`);

        for (const campaign of campaigns) {
          try {
            const keywords = (campaign.industryKeywords as string[]) ?? [];
            const locations = (campaign.locations as string[]) ?? [];
            if (keywords.length === 0) continue;

            const result = await runHeatMapDiscovery(campaign.id, keywords, locations);
            console.log(
              `[Scheduler] Campaign "${campaign.name}": +${result.created} signals (skipped ${result.skipped})`,
            );
          } catch (err) {
            console.error(
              `[Scheduler] Campaign "${campaign.name}" failed:`,
              err instanceof Error ? err.message : err,
            );
          }

          // Pace between campaigns — don't hammer APIs
          await new Promise((r) => setTimeout(r, 3000));
        }

        console.log('[Scheduler] Weekly scan complete');
      } catch (err) {
        console.error('[Scheduler] Fatal error:', err instanceof Error ? err.message : err);
      }
    },
    { timezone: 'Africa/Nairobi' },
  );

  console.log('[Scheduler] Heat map auto-scan scheduled — every Monday 07:00 EAT');
}
