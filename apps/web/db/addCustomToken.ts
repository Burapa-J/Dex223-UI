import { db } from "@/db/db";
import { Token } from "@/sdk_bi/entities/token";

export async function addCustomToken(token: Token): Promise<void> {
  await db.transaction("rw", db.tokenLists.name, async () => {
    const listId = `custom-${token.chainId}` as const;
    const currentCustomList = await db.tokenLists.get(listId);

    if (!currentCustomList) {
      await db.tokenLists.add({
        id: listId,
        enabled: true,
        chainId: token.chainId,
        list: {
          name: "Custom token list",
          version: { minor: 0, major: 0, patch: 0 },
          tokens: [token],
          logoURI: "/images/token-list-placeholder.svg",
        },
      });
      return;
    }

    if (
      currentCustomList.list.tokens.some(
        (savedToken) => savedToken.address0.toLowerCase() === token.address0.toLowerCase(),
      )
    ) {
      return;
    }

    await db.tokenLists.put({
      ...currentCustomList,
      list: {
        ...currentCustomList.list,
        tokens: [...currentCustomList.list.tokens, token],
      },
    });
  });
}
