import { CodeBlock, Inline, Markdown } from '@osw/docs';
import type { DocsMember } from '../model';
import { KindBadge } from './KindBadge';
import { TagTable } from './TagTable';

/** Anchor of a member, unique within its class: `member-get`, `member-static-Props` */
export const memberAnchor = (member: DocsMember) => `member-${member.static ? 'static-' : ''}${member.name}`;

const memberLabel = (member: DocsMember) => (member.kind === 'method' ? `${member.name}()` : member.kind === 'constructor' ? 'new' : member.name);

function Member({ member }: { member: DocsMember }) {
	return (
		<div id={memberAnchor(member)} className="scroll-mt-20 py-6 first:pt-2">
			<div className="flex flex-wrap items-center gap-2">
				<h4 className="font-mono text-base font-semibold">
					<a href={`#${memberAnchor(member)}`} className="hover:text-secondary-660">{memberLabel(member)}</a>
				</h4>
				{member.static && <KindBadge kind="static" />}
				{member.inheritedFrom && <span className="text-xs text-neutral-550">from <code className="font-mono">{member.inheritedFrom}</code></span>}
			</div>

			<div className="mt-3 space-y-2">
				{member.signatures.map((signature, index) => (
					<CodeBlock key={index} code={signature} copyable={false} />
				))}
			</div>

			{member.description && (
				<div className="mt-4">
					<Markdown source={member.description} labels headingTag="h4" />
				</div>
			)}

			<TagTable title="Type parameters" tags={member.templates} />
			<TagTable title="Parameters" tags={member.params} />

			{member.returns && (
				<div className="mt-6">
					<h5 className="text-xs font-semibold tracking-wide text-neutral-550 uppercase">Returns</h5>
					<p className="mt-2 text-sm text-neutral-660"><Inline text={member.returns} /></p>
				</div>
			)}
		</div>
	);
}

/** Documented members of a class: constructor, own members, then inherited ones */
export function MemberList({ members }: { members?: DocsMember[] }) {
	if (!members?.length) return null;

	return (
		<div className="mt-10">
			<h3 className="text-xs font-semibold tracking-wide text-neutral-550 uppercase">Members</h3>
			<div className="mt-2 divide-y divide-neutral-40">
				{members.map((member) => <Member key={memberAnchor(member)} member={member} />)}
			</div>
		</div>
	);
}
