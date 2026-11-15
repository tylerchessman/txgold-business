import { useParams } from 'react-router-dom';
import { wayBySlug } from '@/lib/steps';
import { AccountCode } from '@/ways/AccountCode';
import { AppCheckout } from '@/ways/AppCheckout';
import { OpenRequest } from '@/ways/OpenRequest';
import { RequestFromApp } from '@/ways/RequestFromApp';
import { WebsiteCheckout } from '@/ways/WebsiteCheckout';
import { NotFoundPage } from './NotFoundPage';

export function WayPage() {
  const way = wayBySlug(useParams().slug);
  if (!way) return <NotFoundPage />;
  // key: a fresh flow when moving from one way to the next
  switch (way.number) {
    case 1:
      return <AccountCode key={way.slug} way={way} withAmount={false} />;
    case 2:
      return <AccountCode key={way.slug} way={way} withAmount />;
    case 3:
      return <RequestFromApp key={way.slug} way={way} />;
    case 4:
      return <WebsiteCheckout key={way.slug} way={way} />;
    case 5:
      return <AppCheckout key={way.slug} way={way} />;
    default:
      return <OpenRequest key={way.slug} way={way} />;
  }
}
