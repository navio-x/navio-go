<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center justify-between px-5 pt-5 pb-5">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('assets.title') }}</h1>
      <button
        @click="openCreate"
        class="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0"
        :aria-label="$t('assets.createTitle')"
      >
        <Plus class="w-5 h-5" />
      </button>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3"
    >
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('assets.loading') }}</p>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="tokenBalances.length === 0 && nftBalances.length === 0 && createdCollections.length === 0"
      class="flex-1 flex items-center justify-center px-5 pb-6"
    >
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex flex-col items-center gap-5 text-center w-full max-w-xs">
        <div class="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gh-700 flex items-center justify-center">
          <Layers class="w-10 h-10 text-gray-400 dark:text-gray-500" stroke-width="1.5" />
        </div>
        <div class="space-y-1.5">
          <p class="font-semibold text-gray-800 dark:text-gray-100">{{ $t('assets.noneYet') }}</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('assets.noneYetDesc') }}</p>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="px-5 pb-6 space-y-6">
        <!-- Created collections -->
        <div v-if="createdCollections.length > 0" class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {{ $t('assets.collections') }} ({{ filteredCollections.length }})
            </h2>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                @click="collectionsFilter = 'all'"
                class="px-3 py-1 rounded-lg text-xs font-medium transition"
                :class="collectionsFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gh-800 text-gray-600 dark:text-gray-300'"
              >
                {{ $t('assets.all') }}
              </button>
              <button
                @click="collectionsFilter = 'token'"
                class="px-3 py-1 rounded-lg text-xs font-medium transition"
                :class="collectionsFilter === 'token'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gh-800 text-gray-600 dark:text-gray-300'"
              >
                {{ $t('assets.tokens') }}
              </button>
              <button
                @click="collectionsFilter = 'nft'"
                class="px-3 py-1 rounded-lg text-xs font-medium transition"
                :class="collectionsFilter === 'nft'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gh-800 text-gray-600 dark:text-gray-300'"
              >
                {{ $t('assets.nfts') }}
              </button>
            </div>
          </div>

          <p v-if="filteredCollections.length === 0" class="text-sm text-gray-400 dark:text-gray-500 px-1">
            {{ $t('assets.noneOfKind') }}
          </p>

          <div
            v-for="col in filteredCollections"
            :key="col.collectionTokenId"
            class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3"
          >
            <div
              class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              :class="col.kind === 'nft' ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-blue-100 dark:bg-blue-900/40'"
            >
              <Image v-if="col.kind === 'nft'" class="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <Coins v-else class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ collectionLabel(col) }}
              </p>
              <p class="font-mono text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ col.collectionTokenId }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {{ $t('assets.totalSupply', { n: formatSupply(col.totalSupply) }) }}
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <button
                v-if="col.kind === 'token'"
                @click="openMint(col)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
              >
                {{ $t('assets.mint') }}
              </button>
              <button
                v-else
                @click="openMintNft(col)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
              >
                {{ $t('assets.mint') }}
              </button>
              <button
                @click="copyId(col.collectionTokenId)"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Tokens -->
        <div v-if="tokenBalances.length > 0" class="space-y-2">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">
            {{ $t('assets.tokens') }} ({{ tokenBalances.length }})
          </h2>
          <div
            v-for="asset in tokenBalances"
            :key="asset.tokenId"
            class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3"
          >
            <div class="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Coins class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div class="min-w-0 flex-1">
              <p v-if="assetLabel(asset)" class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ assetLabel(asset) }}
              </p>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 truncate" :class="{ 'mt-0.5': assetLabel(asset) }">{{ asset.tokenId }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {{ $t('assets.outputCount', { n: asset.outputCount }) }}
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <p class="font-semibold tabular-nums text-gray-900 dark:text-white text-sm">{{ asset.balance.toString() }}</p>
              <button
                @click="openSendToken(asset)"
                :aria-label="$t('assets.send')"
                class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Send class="w-3.5 h-3.5" />
              </button>
              <button
                @click="copyId(asset.tokenId)"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- NFTs -->
        <div v-if="nftBalances.length > 0" class="space-y-2">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">
            {{ $t('assets.nfts') }} ({{ nftBalances.length }})
          </h2>
          <div
            v-for="asset in nftBalances"
            :key="asset.tokenId"
            class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3"
          >
            <div class="shrink-0 w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Image class="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div class="min-w-0 flex-1">
              <p v-if="assetLabel(asset)" class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ assetLabel(asset) }}
              </p>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 truncate" :class="{ 'mt-0.5': assetLabel(asset) }">{{ asset.collectionTokenId ?? asset.tokenId }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {{ $t('assets.nftId') }}: {{ asset.nftId != null ? asset.nftId.toString() : '—' }}
              </p>
              <p v-if="nftCollectionMeta(asset)" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                {{ nftCollectionMeta(asset) }}
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <button
                @click="openSendNft(asset)"
                :aria-label="$t('assets.send')"
                class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Send class="w-3.5 h-3.5" />
              </button>
              <button
                @click="copyId(asset.tokenId)"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Mint modal -->
    <div
      v-if="mintTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('assets.mintTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('assets.mintDesc') }}</p>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintAddress') }}</label>
          <input
            v-model="mintAddress"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-xs font-mono
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintAmount') }}</label>
          <input
            v-model="mintAmount"
            @input="onAmountInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="maxAmount" class="text-xs text-gray-400 dark:text-gray-500">
            {{ $t('assets.mintMax', { n: formatSupply(mintTarget.totalSupply) }) }}
          </p>
        </div>
        <p v-if="mintError" class="text-sm text-red-500 dark:text-red-400">{{ mintError }}</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="mintTarget = null"
            :disabled="minting"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="submitMint"
            :disabled="minting || !mintAddress || !amountValid"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ minting ? $t('assets.mintMinting') : $t('assets.mintSubmit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mint NFT modal -->
    <div
      v-if="mintNftTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('assets.mintNftTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('assets.mintDesc') }}</p>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintAddress') }}</label>
          <input
            v-model="nftMintAddress"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-xs font-mono
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintNftId') }}</label>
          <input
            v-model="nftMintNftId"
            @input="onNftIdInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="nftMintTarget?.totalSupply" class="text-xs text-gray-400 dark:text-gray-500">
            {{ $t('assets.mintMax', { n: formatSupply(nftMintTarget.totalSupply) }) }}
          </p>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintNftName') }}</label>
          <input
            v-model="nftMintName"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintNftRarity') }}</label>
          <input
            v-model="nftMintRarity"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p v-if="nftMintError" class="text-sm text-red-500 dark:text-red-400">{{ nftMintError }}</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="mintNftTarget = null"
            :disabled="nftMinting"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="submitMintNft"
            :disabled="nftMinting || !nftMintAddress || !nftIdValid"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ nftMinting ? $t('assets.mintMinting') : $t('assets.mintSubmit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Send Token modal -->
    <div
      v-if="sendTokenTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('assets.sendTokenTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">
          {{ assetLabel(sendTokenTarget) ?? sendTokenTarget.tokenId }}
        </p>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintAddress') }}</label>
          <input
            v-model="sendTokenAddress"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-xs font-mono
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintAmount') }}</label>
            <button
              @click="sendTokenAmount = sendTokenTarget.balance.toString()"
              class="text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              {{ $t('wallet.useAll') }}
            </button>
          </div>
          <input
            v-model="sendTokenAmount"
            @input="onSendTokenAmountInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ $t('assets.mintMax', { n: sendTokenTarget.balance.toString() }) }}
          </p>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('wallet.memoLabel') }}</label>
          <input
            v-model="sendTokenMemo"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p v-if="sendTokenError" class="text-sm text-red-500 dark:text-red-400">{{ sendTokenError }}</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="sendTokenTarget = null"
            :disabled="sendingToken"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="submitSendToken"
            :disabled="sendingToken || !sendTokenAddress || !sendTokenAmountValid"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ sendingToken ? $t('wallet.sendingTransaction') : $t('assets.send') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Send NFT modal -->
    <div
      v-if="sendNftTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('assets.sendNftTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">
          {{ assetLabel(sendNftTarget) ?? sendNftTarget.tokenId }}
          <span class="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {{ $t('assets.nftId') }}: {{ sendNftTarget.nftId != null ? sendNftTarget.nftId.toString() : '—' }}
          </span>
        </p>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.mintAddress') }}</label>
          <input
            v-model="sendNftAddress"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-xs font-mono
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('wallet.memoLabel') }}</label>
          <input
            v-model="sendNftMemo"
            type="text"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p v-if="sendNftError" class="text-sm text-red-500 dark:text-red-400">{{ sendNftError }}</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="sendNftTarget = null"
            :disabled="sendingNft"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="submitSendNft"
            :disabled="sendingNft || !sendNftAddress"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ sendingNft ? $t('wallet.sendingTransaction') : $t('assets.send') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create collection modal -->
    <div
      v-if="showCreate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('assets.createTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('assets.createDesc') }}</p>

        <div class="grid grid-cols-2 gap-2">
          <button
            @click="createKind = 'token'"
            class="py-2 rounded-xl text-sm font-medium transition border flex items-center justify-center gap-1.5"
            :class="createKind === 'token'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gh-800 border-transparent text-gray-700 dark:text-gray-300'"
          >
            <Coins class="w-4 h-4" />
            {{ $t('assets.createKindToken') }}
          </button>
          <button
            @click="createKind = 'nft'"
            class="py-2 rounded-xl text-sm font-medium transition border flex items-center justify-center gap-1.5"
            :class="createKind === 'nft'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gh-800 border-transparent text-gray-700 dark:text-gray-300'"
          >
            <Image class="w-4 h-4" />
            {{ $t('assets.createKindNft') }}
          </button>
        </div>

        <template v-if="createKind === 'token'">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.createName') }}</label>
            <input
              v-model="createName"
              type="text"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
              bg-white dark:bg-gh-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.createSymbol') }}</label>
            <input
              v-model="createSymbol"
              type="text"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
              bg-white dark:bg-gh-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </template>

        <template v-else>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.createCollectionName') }}</label>
            <input
              v-model="createCollectionName"
              type="text"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
              bg-white dark:bg-gh-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.createCreator') }}</label>
            <input
              v-model="createCreator"
              type="text"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
              bg-white dark:bg-gh-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </template>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('assets.createTotalSupply') }}</label>
          <input
            v-model="createTotalSupply"
            @input="onTotalSupplyInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
            bg-white dark:bg-gh-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p v-if="createError" class="text-sm text-red-500 dark:text-red-400">{{ createError }}</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="showCreate = false"
            :disabled="creating"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="submitCreate"
            :disabled="creating || !createFormValid"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ creating ? $t('assets.createCreating') : $t('assets.createSubmit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  tokenBalances,
  nftBalances,
  createdCollections,
  receiveAddress,
  refreshAssetBalances,
  refreshCreatedCollections,
  mintTokenFromCollection,
  mintNftFromCollection,
  createCollection,
  sendTokenAsset,
  sendNftAsset,
} from "@/stores/navio";
import { Loader2, Layers, Coins, Image, Copy, Plus, Send } from "lucide-vue-next";
import copy from "copy-to-clipboard";
import { useI18n } from "vue-i18n";

const { locale, t } = useI18n();

const loading = ref(true);
let pollTimer = null;

function formatSupply(value) {
  return value.toLocaleString(locale.value);
}

function collectionLabel(col) {
  const { name, symbol, collection, creator, note } = col.metadata ?? {};
  if (name && symbol) return `${name} (${symbol})`;
  if (name) return name;
  if (symbol) return symbol;
  if (collection && creator) return `${collection} (${creator})`;
  if (collection) return collection;
  if (creator) return creator;
  if (note) return note;
  return t("assets.noNote");
}

function assetLabel(asset) {
  const { name, symbol } = asset.metadata ?? {};
  if (name && symbol) return `${name} (${symbol})`;
  if (name) return name;
  if (symbol) return symbol;
  return null;
}

function nftCollectionMeta(asset) {
  const { collection, creator } = asset.metadata ?? {};
  if (!collection && !creator) return null;
  const parts = [];
  if (collection) parts.push(`${t("assets.createCollectionName")}: ${collection}`);
  if (creator) parts.push(`${t("assets.createCreator")}: ${creator}`);
  return parts.join(" · ");
}

async function refreshAll() {
  await Promise.all([refreshAssetBalances(), refreshCreatedCollections()]);
}

const collectionsFilter = ref("all");
const filteredCollections = computed(() =>
  collectionsFilter.value === "all"
    ? createdCollections.value
    : createdCollections.value.filter((col) => col.kind === collectionsFilter.value)
);

onMounted(async () => {
  await refreshAll();
  loading.value = false;
  pollTimer = setInterval(refreshAll, 10000);
});

onUnmounted(() => {
  clearInterval(pollTimer);
});

function copyId(id) {
  copy(id);
}

const mintTarget = ref(null);
const mintAddress = ref("");
const mintAmount = ref("");
const minting = ref(false);
const mintError = ref("");

const maxAmount = computed(() => mintTarget.value?.totalSupply?.toString() ?? null);

const amountValid = computed(() => {
  if (mintAmount.value === "") return false;
  if (!/^\d+$/.test(mintAmount.value)) return false;
  const amount = BigInt(mintAmount.value);
  if (amount < 0n) return false;
  if (mintTarget.value?.totalSupply != null && amount > mintTarget.value.totalSupply) return false;
  return true;
});

function onAmountInput() {
  const digitsOnly = mintAmount.value.replace(/[^\d]/g, "");
  mintAmount.value = digitsOnly;
}

function openMint(col) {
  mintTarget.value = col;
  mintAddress.value = receiveAddress.value ?? "";
  mintAmount.value = "";
  mintError.value = "";
}

async function submitMint() {
  if (!amountValid.value) return;
  minting.value = true;
  mintError.value = "";
  try {
    await mintTokenFromCollection({
      address: mintAddress.value.trim(),
      collectionTokenId: mintTarget.value.collectionTokenId,
      amount: mintAmount.value,
    });
    mintTarget.value = null;
  } catch (err) {
    mintError.value = err?.message ?? String(err);
  } finally {
    minting.value = false;
  }
}

const mintNftTarget = ref(null);
const nftMintAddress = ref("");
const nftMintNftId = ref("");
const nftMintName = ref("");
const nftMintRarity = ref("");
const nftMinting = ref(false);
const nftMintError = ref("");

const nftIdValid = computed(() => {
  if (nftMintNftId.value === "") return false;
  if (!/^\d+$/.test(nftMintNftId.value)) return false;
  const id = BigInt(nftMintNftId.value);
  if (id < 0n) return false;
  if (mintNftTarget.value?.totalSupply != null && mintNftTarget.value.totalSupply > 0n && id > mintNftTarget.value.totalSupply) {
    return false;
  }
  return true;
});

function onNftIdInput() {
  nftMintNftId.value = nftMintNftId.value.replace(/[^\d]/g, "");
}

function openMintNft(col) {
  mintNftTarget.value = col;
  nftMintAddress.value = receiveAddress.value ?? "";
  nftMintNftId.value = "";
  nftMintName.value = "";
  nftMintRarity.value = "";
  nftMintError.value = "";
}

async function submitMintNft() {
  if (!nftIdValid.value) return;
  nftMinting.value = true;
  nftMintError.value = "";
  try {
    const metadata = {};
    if (nftMintName.value.trim()) metadata.name = nftMintName.value.trim();
    if (nftMintRarity.value.trim()) metadata.rarity = nftMintRarity.value.trim();
    await mintNftFromCollection({
      address: nftMintAddress.value.trim(),
      collectionTokenId: mintNftTarget.value.collectionTokenId,
      nftId: nftMintNftId.value,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
    mintNftTarget.value = null;
  } catch (err) {
    nftMintError.value = err?.message ?? String(err);
  } finally {
    nftMinting.value = false;
  }
}

const sendTokenTarget = ref(null);
const sendTokenAddress = ref("");
const sendTokenAmount = ref("");
const sendTokenMemo = ref("");
const sendingToken = ref(false);
const sendTokenError = ref("");

const sendTokenAmountValid = computed(() => {
  if (sendTokenAmount.value === "") return false;
  if (!/^\d+$/.test(sendTokenAmount.value)) return false;
  const amount = BigInt(sendTokenAmount.value);
  if (amount <= 0n) return false;
  if (sendTokenTarget.value && amount > sendTokenTarget.value.balance) return false;
  return true;
});

function onSendTokenAmountInput() {
  sendTokenAmount.value = sendTokenAmount.value.replace(/[^\d]/g, "");
}

function openSendToken(asset) {
  sendTokenTarget.value = asset;
  sendTokenAddress.value = "";
  sendTokenAmount.value = "";
  sendTokenMemo.value = "";
  sendTokenError.value = "";
}

async function submitSendToken() {
  if (!sendTokenAmountValid.value) return;
  sendingToken.value = true;
  sendTokenError.value = "";
  try {
    await sendTokenAsset({
      address: sendTokenAddress.value.trim(),
      tokenId: sendTokenTarget.value.tokenId,
      amount: sendTokenAmount.value,
      memo: sendTokenMemo.value.trim(),
    });
    sendTokenTarget.value = null;
  } catch (err) {
    sendTokenError.value = err?.message ?? String(err);
  } finally {
    sendingToken.value = false;
  }
}

const sendNftTarget = ref(null);
const sendNftAddress = ref("");
const sendNftMemo = ref("");
const sendingNft = ref(false);
const sendNftError = ref("");

function openSendNft(asset) {
  sendNftTarget.value = asset;
  sendNftAddress.value = "";
  sendNftMemo.value = "";
  sendNftError.value = "";
}

async function submitSendNft() {
  if (!sendNftAddress.value.trim()) return;
  sendingNft.value = true;
  sendNftError.value = "";
  try {
    await sendNftAsset({
      address: sendNftAddress.value.trim(),
      tokenId: sendNftTarget.value.tokenId,
      memo: sendNftMemo.value.trim(),
    });
    sendNftTarget.value = null;
  } catch (err) {
    sendNftError.value = err?.message ?? String(err);
  } finally {
    sendingNft.value = false;
  }
}

const showCreate = ref(false);
const createKind = ref("token");
const createName = ref("");
const createSymbol = ref("");
const createCollectionName = ref("");
const createCreator = ref("");
const createTotalSupply = ref("");
const creating = ref(false);
const createError = ref("");

const createFormValid = computed(() => {
  if (createTotalSupply.value === "") return false;
  if (!/^\d+$/.test(createTotalSupply.value)) return false;
  if (createKind.value === "nft") {
    return createCollectionName.value.trim() !== "" && createCreator.value.trim() !== "";
  }
  return BigInt(createTotalSupply.value) > 0n;
});

function onTotalSupplyInput() {
  createTotalSupply.value = createTotalSupply.value.replace(/[^\d]/g, "");
}

function openCreate() {
  showCreate.value = true;
  createKind.value = "token";
  createName.value = "";
  createSymbol.value = "";
  createCollectionName.value = "";
  createCreator.value = "";
  createTotalSupply.value = "";
  createError.value = "";
}

async function submitCreate() {
  if (!createFormValid.value) return;
  creating.value = true;
  createError.value = "";
  try {
    const metadata = {};
    if (createKind.value === "nft") {
      if (createCollectionName.value.trim()) metadata.collection = createCollectionName.value.trim();
      if (createCreator.value.trim()) metadata.creator = createCreator.value.trim();
    } else {
      if (createName.value.trim()) metadata.name = createName.value.trim();
      if (createSymbol.value.trim()) metadata.symbol = createSymbol.value.trim();
    }
    await createCollection({
      kind: createKind.value,
      metadata: Object.keys(metadata).length ? metadata : undefined,
      totalSupply: createTotalSupply.value || "0",
    });
    showCreate.value = false;
  } catch (err) {
    createError.value = err?.message ?? String(err);
  } finally {
    creating.value = false;
  }
}
</script>
