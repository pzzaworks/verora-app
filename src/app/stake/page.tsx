import { redirect } from 'next/navigation';

/** Staking lives on each agent page and in the dashboard; old /stake links land on the dashboard */
export default function StakePage() {
  redirect('/dashboard');
}
