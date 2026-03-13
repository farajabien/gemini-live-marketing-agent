/**
 * Global registry to track active FFmpeg processes per plan.
 * This allows us to kill orphaned or previous renders when a new one is forced.
 */
import type { FfmpegCommand } from "fluent-ffmpeg";

// Global map to track active commands
// Note: In a production serverless environment, this would need a different approach (e.g. heartbeat/status check)
// but for local development and single-server deployments, this works perfectly.
const activeCommands = new Map<string, Set<FfmpegCommand>>();

export const FFmpegRegistry = {
  /**
   * Register a command for a plan
   */
  register(planId: string, command: FfmpegCommand) {
    if (!activeCommands.has(planId)) {
      activeCommands.set(planId, new Set());
    }
    activeCommands.get(planId)!.add(command);

    // Remove when command finishes
    command.on('end', () => this.unregister(planId, command));
    command.on('error', () => this.unregister(planId, command));
  },

  /**
   * Unregister a command
   */
  unregister(planId: string, command: FfmpegCommand) {
    activeCommands.get(planId)?.delete(command);
    if (activeCommands.get(planId)?.size === 0) {
      activeCommands.delete(planId);
    }
  },

  /**
   * Kill all active commands for a plan
   */
  async killForPlan(planId: string) {
    const commands = activeCommands.get(planId);
    if (!commands || commands.size === 0) return;

    console.log(`[FFmpeg Registry] Killing ${commands.size} active processes for plan ${planId}`);
    
    for (const command of commands) {
      try {
        command.kill('SIGKILL');
      } catch (err) {
        console.warn(`[FFmpeg Registry] Failed to kill process for ${planId}:`, err);
      }
    }
    
    activeCommands.delete(planId);
    // Give OS a moment to reclaim resources
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
