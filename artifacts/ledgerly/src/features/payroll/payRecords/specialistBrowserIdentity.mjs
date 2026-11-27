// Clerk adapter for the disposable payroll and tax browser bundles only.
export function useUser() {
  return {user:{id:window.syntheticPayFixture.sessionActor ?? window.syntheticPayFixture.submitter ?? window.syntheticPayFixture.reader},isLoaded:true,isSignedIn:true};
}
export function useClerk() {
  return {};
}
