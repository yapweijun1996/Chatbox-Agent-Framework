export async function execute(input) {
    return { result: `child:${input?.value ?? ''}` };
}
