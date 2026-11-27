// Clerk adapter for the disposable tax browser bundle only.
export function useUser() {
  return {user:{id:window.syntheticPayFixture.submitter},isLoaded:true,isSignedIn:true};
}
export function useClerk() {
  return {};
}
