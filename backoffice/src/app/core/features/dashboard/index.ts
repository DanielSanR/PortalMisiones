/** Superficie pública del feature dashboard (Home). */
export { DashboardFacade } from './facades/dashboard.facade';
export type {
  DashboardHomeVM, DashboardColor, QueueItemVM, MyQueueItemVM, PipelineSegmentVM, MineItemVM, OrgBarVM,
  SearchItemVM, TopTramiteItemVM, FeedbackItemVM, ActivityItemVM,
} from './models/dashboard.vm';
export { provideDashboardFeature } from './dashboard.providers';
