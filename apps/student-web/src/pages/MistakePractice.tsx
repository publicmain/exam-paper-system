import { Navigate } from 'react-router-dom';
import { ROUTES } from '../routes.contract';

/** Historical bookmarks return to the reading result, which owns today's redo. */
export default function MistakePracticePage() {
  return <Navigate to={ROUTES.readingResult} replace />;
}
