import { LeadTagsEditor } from './LeadTagsEditor';

type Props = {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

/** Project/campaign tags — same chips as lead tags, org suggestions from CRM config. */
export function ProjectTagsEditor(props: Props) {
  return <LeadTagsEditor {...props} />;
}
