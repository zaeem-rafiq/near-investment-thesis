/** Node's ordered reporting events supply names and parent groups, never source text. */
export default async function* reporter(source) {
  const stacks = new Map()
  for await (const event of source) {
    const d = event.data
    if (!d.file) continue
    if (event.type === 'test:start') {
      const stack = stacks.get(d.file) ?? []
      stack.length = d.nesting
      stack.push(d.name)
      stacks.set(d.file, stack)
    }
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      yield JSON.stringify({
        type: event.type,
        file: d.file,
        name: d.name,
        chain: (stacks.get(d.file) ?? []).slice(0, d.nesting),
        nesting: d.nesting,
        skip: d.skip ?? false,
        todo: d.todo ?? false,
        suite: d.details?.type === 'suite',
        fileFailure: event.type === 'test:fail' && d.name === d.file,
      }) + '\n'
    }
  }
}
