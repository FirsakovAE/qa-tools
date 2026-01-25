/**
 * Network Module Entry Point
 */

export { initNetworkModule, cleanupNetworkModule } from './bridge'
export { 
  pauseInterception, 
  resumeInterception,
  isInterceptionPaused 
} from './interceptor'
export type { PendingRequest, InterceptorCallbacks, ResponseData } from './types'
