console.error("Default receiver deployment is blocked: the disabled local configuration would overwrite production. After release approval, use npm run deploy:production and the reviewed production configuration.");
process.exitCode = 1;
