/** Present a labeled local-community count without decorative analytics. */
import PropTypes from 'prop-types';

const accents = {
  indigo: 'border-indigo-500', violet: 'border-violet-500',
  pink: 'border-pink-500', teal: 'border-teal-500',
};

/** Render an exact statistic label and its count.
 * Args: label: User-facing metric. count: Current total. accent: Border treatment.
 * Returns: Accessible definition list with tabular numerics.
 */
export function StatCard({ label, count, accent = 'indigo' }) {
  return (
    <dl className={`rounded-xl border border-t-4 bg-white p-5 shadow-sm ${accents[accent]}`}>
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{count}</dd>
    </dl>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  accent: PropTypes.oneOf(['indigo', 'violet', 'pink', 'teal']),
};
