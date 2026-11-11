import Loading from '../ui/Loading.jsx';

// Shown by the route guards while a stored session is being checked.
export default function AuthLoading() {
  return (
    <div className="page-loading">
      <Loading />
    </div>
  );
}
