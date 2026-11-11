// Where to go after logging in or signing up: the page RequireAuth sent the
// user away from (state.from), or the dashboard. Login, Signup and GuestOnly
// all redirect right after a successful submit, so they share this to make
// sure they agree.
export function afterAuthPath(location) {
  return location.state?.from?.pathname || '/dashboard';
}
