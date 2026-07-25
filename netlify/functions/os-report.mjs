import { runOSHealthReport } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";

export default withFailureAlert("os-report", (req) => runOSHealthReport(req));
